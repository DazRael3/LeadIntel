import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace, getCurrentWorkspace } from '@/lib/team/workspace'
import { getActivityCounts, stampLeadLibrarySeen, type ActivityCounts } from '@/lib/services/lead-activity'
import { redactPotentialSecrets } from '@/lib/security/token-redaction'

export const dynamic = 'force-dynamic'

const EMPTY_ACTIVITY_SUMMARY: ActivityCounts = {
  newLeadsSinceLastVisit: 0,
  campaignsAwaitingAction: 0,
}

type LeadActivityMetaState =
  | 'ready'
  | 'empty'
  | 'workspace_missing'
  | 'workspace_unavailable'
  | 'forbidden'
  | 'schema_unavailable'
  | 'activity_unavailable'

type LeadActivityFallbackReason =
  | 'activity_available'
  | 'no_recent_activity'
  | 'workspace_not_found'
  | 'workspace_resolution_failed'
  | 'workspace_schema_not_ready'
  | 'workspace_forbidden'
  | 'activity_schema_not_ready'
  | 'activity_forbidden'
  | 'activity_query_unavailable'
  | 'activity_stamp_skipped'

type LeadActivityData = {
  summary: ActivityCounts
  items: Array<never>
  meta: {
    state: LeadActivityMetaState
    fallback: boolean
    reason: LeadActivityFallbackReason
    hasWorkspace: boolean
    generatedAt: string
  }
}

type SafeErrorDetails = {
  code: string | null
  message: string | null
}

type ExpectedFallbackClassification = {
  state: Exclude<LeadActivityMetaState, 'ready' | 'empty' | 'workspace_missing'>
  reason: LeadActivityFallbackReason
}

type WorkspaceResolutionResult =
  | { workspaceId: string; fallbackResponse: null }
  | { workspaceId: null; fallbackResponse: ReturnType<typeof ok> }

function toSafeErrorDetails(error: unknown): SafeErrorDetails {
  const errorRecord = error as { code?: unknown; message?: unknown } | null
  const code = typeof errorRecord?.code === 'string' && errorRecord.code.trim().length > 0 ? errorRecord.code : null
  const rawMessage = typeof errorRecord?.message === 'string' ? errorRecord.message : error instanceof Error ? error.message : null
  const message = rawMessage ? redactPotentialSecrets(rawMessage).slice(0, 220) : null
  return { code, message }
}

function getErrorMessageLower(error: unknown): string {
  const details = toSafeErrorDetails(error)
  return (details.message ?? '').toLowerCase()
}

function isSchemaError(error: unknown): boolean {
  const { code } = toSafeErrorDetails(error)
  const message = getErrorMessageLower(error)
  return (
    code === 'PGRST106' ||
    code === 'PGRST204' ||
    code === '42P01' ||
    code === '42703' ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('undefined_table') ||
    message.includes('does not exist') ||
    message.includes('invalid schema')
  )
}

function isPermissionError(error: unknown): boolean {
  const { code } = toSafeErrorDetails(error)
  const message = getErrorMessageLower(error)
  return (
    code === '42501' ||
    message.includes('permission denied') ||
    message.includes('row-level security') ||
    message.includes('insufficient privilege')
  )
}

function isAvailabilityError(error: unknown): boolean {
  const { code } = toSafeErrorDetails(error)
  const message = getErrorMessageLower(error)
  if (typeof code === 'string' && code.startsWith('PGRST')) return true
  return (
    message.includes('failed to create workspace') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('timed out') ||
    message.includes('service unavailable') ||
    message.includes('connection')
  )
}

function classifyExpectedWorkspaceFailure(error: unknown): ExpectedFallbackClassification | null {
  if (isSchemaError(error)) {
    return { state: 'workspace_unavailable', reason: 'workspace_schema_not_ready' }
  }
  if (isPermissionError(error)) {
    return { state: 'workspace_unavailable', reason: 'workspace_forbidden' }
  }
  if (isAvailabilityError(error)) {
    return { state: 'workspace_unavailable', reason: 'workspace_resolution_failed' }
  }
  return null
}

function classifyExpectedActivityFailure(error: unknown): ExpectedFallbackClassification | null {
  if (isSchemaError(error)) {
    return { state: 'schema_unavailable', reason: 'activity_schema_not_ready' }
  }
  if (isPermissionError(error)) {
    return { state: 'forbidden', reason: 'activity_forbidden' }
  }
  if (isAvailabilityError(error)) {
    return { state: 'activity_unavailable', reason: 'activity_query_unavailable' }
  }
  return null
}

function logLeadActivityFallback(args: {
  stage: 'workspace_resolve' | 'activity_read' | 'activity_stamp'
  requestId: string
  userId: string
  classification: ExpectedFallbackClassification
  error: unknown
}): void {
  const details = toSafeErrorDetails(args.error)
  console.warn('[lead-activity] returning fallback payload', {
    route: '/api/lead-activity',
    stage: args.stage,
    requestId: args.requestId,
    userId: args.userId,
    fallbackState: args.classification.state,
    fallbackReason: args.classification.reason,
    errorCode: details.code,
    errorMessage: details.message,
  })
}

function buildLeadActivityData(args: {
  state: LeadActivityMetaState
  reason: LeadActivityFallbackReason
  fallback: boolean
  hasWorkspace: boolean
  summary?: ActivityCounts
}): LeadActivityData {
  return {
    summary: args.summary ?? EMPTY_ACTIVITY_SUMMARY,
    items: [],
    meta: {
      state: args.state,
      fallback: args.fallback,
      reason: args.reason,
      hasWorkspace: args.hasWorkspace,
      generatedAt: new Date().toISOString(),
    },
  }
}

function buildWorkspaceFallbackResponse(args: {
  classification: ExpectedFallbackClassification
  bridge: ReturnType<typeof createCookieBridge>
  requestId: string
}): ReturnType<typeof ok> {
  return ok(
    buildLeadActivityData({
      state: args.classification.state,
      reason: args.classification.reason,
      fallback: true,
      hasWorkspace: false,
    }),
    undefined,
    args.bridge,
    args.requestId
  )
}

async function resolveWorkspaceForActivity(args: {
  supabase: ReturnType<typeof createRouteClient>
  userId: string
  bridge: ReturnType<typeof createCookieBridge>
  requestId: string
}): Promise<WorkspaceResolutionResult> {
  let workspace = null as Awaited<ReturnType<typeof getCurrentWorkspace>> | null
  try {
    workspace = await getCurrentWorkspace({ supabase: args.supabase, userId: args.userId })
  } catch (error) {
    const expectedFallback = classifyExpectedWorkspaceFailure(error)
    if (expectedFallback) {
      logLeadActivityFallback({
        stage: 'workspace_resolve',
        requestId: args.requestId,
        userId: args.userId,
        classification: expectedFallback,
        error,
      })
      return {
        workspaceId: null,
        fallbackResponse: buildWorkspaceFallbackResponse({
          classification: expectedFallback,
          bridge: args.bridge,
          requestId: args.requestId,
        }),
      }
    }
    throw error
  }

  if (!workspace) {
    try {
      await ensurePersonalWorkspace({ supabase: args.supabase, userId: args.userId })
    } catch (error) {
      const expectedFallback = classifyExpectedWorkspaceFailure(error)
      if (expectedFallback) {
        logLeadActivityFallback({
          stage: 'workspace_resolve',
          requestId: args.requestId,
          userId: args.userId,
          classification: expectedFallback,
          error,
        })
        return {
          workspaceId: null,
          fallbackResponse: buildWorkspaceFallbackResponse({
            classification: expectedFallback,
            bridge: args.bridge,
            requestId: args.requestId,
          }),
        }
      }
      throw error
    }
    try {
      workspace = await getCurrentWorkspace({ supabase: args.supabase, userId: args.userId })
    } catch (error) {
      const expectedFallback = classifyExpectedWorkspaceFailure(error)
      if (expectedFallback) {
        logLeadActivityFallback({
          stage: 'workspace_resolve',
          requestId: args.requestId,
          userId: args.userId,
          classification: expectedFallback,
          error,
        })
        return {
          workspaceId: null,
          fallbackResponse: buildWorkspaceFallbackResponse({
            classification: expectedFallback,
            bridge: args.bridge,
            requestId: args.requestId,
          }),
        }
      }
      throw error
    }
  }

  if (!workspace) {
    return {
      workspaceId: null,
      fallbackResponse: ok(
        buildLeadActivityData({
          state: 'workspace_missing',
          reason: 'workspace_not_found',
          fallback: true,
          hasWorkspace: false,
        }),
        undefined,
        args.bridge,
        args.requestId
      ),
    }
  }

  return {
    workspaceId: workspace.id,
    fallbackResponse: null,
  }
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const workspaceResolution = await resolveWorkspaceForActivity({
      supabase,
      userId: user.id,
      bridge,
      requestId,
    })
    if (workspaceResolution.fallbackResponse) {
      return workspaceResolution.fallbackResponse
    }

    let summary: ActivityCounts
    try {
      summary = await getActivityCounts({
        supabase,
        userId: user.id,
        workspaceId: workspaceResolution.workspaceId,
      })
    } catch (error) {
      const expectedFallback = classifyExpectedActivityFailure(error)
      if (expectedFallback) {
        logLeadActivityFallback({
          stage: 'activity_read',
          requestId,
          userId: user.id,
          classification: expectedFallback,
          error,
        })
        return ok(
          buildLeadActivityData({
            state: expectedFallback.state,
            reason: expectedFallback.reason,
            fallback: true,
            hasWorkspace: true,
          }),
          undefined,
          bridge,
          requestId
        )
      }
      throw error
    }

    const hasActivity = summary.newLeadsSinceLastVisit > 0 || summary.campaignsAwaitingAction > 0
    return ok(
      buildLeadActivityData({
        summary,
        state: hasActivity ? 'ready' : 'empty',
        reason: hasActivity ? 'activity_available' : 'no_recent_activity',
        fallback: false,
        hasWorkspace: true,
      }),
      undefined,
      bridge,
      requestId
    )
  } catch (error) {
    return asHttpError(error, '/api/lead-activity', userId ?? undefined, bridge, requestId)
  }
})

export const POST = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    try {
      await stampLeadLibrarySeen({ supabase, userId: user.id })
    } catch (error) {
      const expectedFallback = classifyExpectedActivityFailure(error)
      if (expectedFallback) {
        logLeadActivityFallback({
          stage: 'activity_stamp',
          requestId,
          userId: user.id,
          classification: expectedFallback,
          error,
        })
        return ok({ stamped: false, skipped: true, reason: 'activity_stamp_skipped' }, undefined, bridge, requestId)
      }
      throw error
    }

    return ok({ stamped: true }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/lead-activity', userId ?? undefined, bridge, requestId)
  }
})
