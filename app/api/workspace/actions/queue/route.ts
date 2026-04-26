import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { listActionQueueItems } from '@/lib/services/action-queue'
import type { ActionQueueStatus } from '@/lib/domain/action-queue'
import { logProductEvent } from '@/lib/services/analytics'
import { redactPotentialSecrets } from '@/lib/security/token-redaction'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  status: z
    .enum(['ready', 'queued', 'processing', 'delivered', 'failed', 'blocked', 'manual_review', 'all'])
    .optional()
    .default('all'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
})

type QueueMetaState =
  | 'ready'
  | 'empty'
  | 'upgrade_required'
  | 'workspace_missing'
  | 'queue_unavailable'
  | 'schema_unavailable'
  | 'restricted'

type QueueMetaReason =
  | 'items_loaded'
  | 'no_actions'
  | 'capability_denied'
  | 'workspace_not_found'
  | 'queue_query_unavailable'
  | 'queue_schema_not_ready'
  | 'queue_rls_blocked'

type QueueResponsePayload = {
  items: Array<unknown>
  meta: {
    state: QueueMetaState
    reason: QueueMetaReason
    fallback: boolean
    hasWorkspace: boolean
    canDeliver: boolean
    generatedAt: string
  }
}

function buildQueueResponse(args: {
  items?: Array<unknown>
  state: QueueMetaState
  reason: QueueMetaReason
  fallback: boolean
  hasWorkspace: boolean
  canDeliver: boolean
}): QueueResponsePayload {
  return {
    items: args.items ?? [],
    meta: {
      state: args.state,
      reason: args.reason,
      fallback: args.fallback,
      hasWorkspace: args.hasWorkspace,
      canDeliver: args.canDeliver,
      generatedAt: new Date().toISOString(),
    },
  }
}

function safeErrorDetails(error: unknown): { code: string | null; message: string | null } {
  const record = error as { code?: unknown; message?: unknown } | null
  const code = typeof record?.code === 'string' && record.code.trim().length > 0 ? record.code : null
  const rawMessage = typeof record?.message === 'string' ? record.message : error instanceof Error ? error.message : null
  const message = rawMessage ? redactPotentialSecrets(rawMessage).slice(0, 220) : null
  return { code, message }
}

function isSchemaError(error: unknown): boolean {
  const details = safeErrorDetails(error)
  const message = (details.message ?? '').toLowerCase()
  return (
    details.code === 'PGRST106' ||
    details.code === 'PGRST204' ||
    details.code === '42P01' ||
    details.code === '42703' ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('does not exist') ||
    message.includes('invalid schema')
  )
}

function isPermissionError(error: unknown): boolean {
  const details = safeErrorDetails(error)
  const message = (details.message ?? '').toLowerCase()
  return (
    details.code === '42501' ||
    message.includes('permission denied') ||
    message.includes('row-level security') ||
    message.includes('insufficient privilege')
  )
}

function logQueueFallback(args: {
  stage: 'workspace' | 'items' | 'analytics'
  requestId: string
  userId: string
  error: unknown
  state: QueueMetaState
  reason: QueueMetaReason
}): void {
  const details = safeErrorDetails(args.error)
  console.warn('[actions-queue] returning fallback payload', {
    route: '/api/workspace/actions/queue',
    stage: args.stage,
    requestId: args.requestId,
    userId: args.userId,
    fallbackState: args.state,
    fallbackReason: args.reason,
    errorCode: details.code,
    errorMessage: details.message,
  })
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'action_queue' })
    if (!gate.ok) {
      return ok(
        buildQueueResponse({
          state: 'upgrade_required',
          reason: 'capability_denied',
          fallback: true,
          hasWorkspace: false,
          canDeliver: false,
        }),
        undefined,
        bridge,
        requestId
      )
    }

    const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    let workspace = null as Awaited<ReturnType<typeof getCurrentWorkspace>> | null
    try {
      workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    } catch (error) {
      if (isSchemaError(error) || isPermissionError(error)) {
        logQueueFallback({
          stage: 'workspace',
          requestId,
          userId: user.id,
          error,
          state: 'queue_unavailable',
          reason: 'queue_query_unavailable',
        })
        return ok(
          buildQueueResponse({
            state: 'queue_unavailable',
            reason: 'queue_query_unavailable',
            fallback: true,
            hasWorkspace: false,
            canDeliver: false,
          }),
          undefined,
          bridge,
          requestId
        )
      }
      throw error
    }

    if (!workspace) {
      return ok(
        buildQueueResponse({
          state: 'workspace_missing',
          reason: 'workspace_not_found',
          fallback: true,
          hasWorkspace: false,
          canDeliver: false,
        }),
        undefined,
        bridge,
        requestId
      )
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    let items: Array<unknown>
    try {
      items = await listActionQueueItems({
        supabase,
        workspaceId: workspace.id,
        status: parsed.data.status === 'all' ? 'all' : (parsed.data.status as ActionQueueStatus),
        limit: parsed.data.limit,
      })
    } catch (error) {
      if (isSchemaError(error)) {
        logQueueFallback({
          stage: 'items',
          requestId,
          userId: user.id,
          error,
          state: 'schema_unavailable',
          reason: 'queue_schema_not_ready',
        })
        return ok(
          buildQueueResponse({
            state: 'schema_unavailable',
            reason: 'queue_schema_not_ready',
            fallback: true,
            hasWorkspace: true,
            canDeliver: false,
          }),
          undefined,
          bridge,
          requestId
        )
      }
      if (isPermissionError(error)) {
        logQueueFallback({
          stage: 'items',
          requestId,
          userId: user.id,
          error,
          state: 'restricted',
          reason: 'queue_rls_blocked',
        })
        return ok(
          buildQueueResponse({
            state: 'restricted',
            reason: 'queue_rls_blocked',
            fallback: true,
            hasWorkspace: true,
            canDeliver: false,
          }),
          undefined,
          bridge,
          requestId
        )
      }
      throw error
    }

    try {
      await logProductEvent({
        userId: user.id,
        eventName: 'action_queue_viewed',
        eventProps: { workspaceId: workspace.id, status: parsed.data.status, limit: parsed.data.limit },
      })
    } catch (error) {
      // Analytics should never crash this route.
      logQueueFallback({
        stage: 'analytics',
        requestId,
        userId: user.id,
        error,
        state: items.length > 0 ? 'ready' : 'empty',
        reason: items.length > 0 ? 'items_loaded' : 'no_actions',
      })
    }

    return ok(
      buildQueueResponse({
        items,
        state: items.length > 0 ? 'ready' : 'empty',
        reason: items.length > 0 ? 'items_loaded' : 'no_actions',
        fallback: false,
        hasWorkspace: true,
        canDeliver: true,
      }),
      undefined,
      bridge,
      requestId
    )
  } catch (e) {
    return asHttpError(e, '/api/workspace/actions/queue', userId, bridge, requestId)
  }
})

