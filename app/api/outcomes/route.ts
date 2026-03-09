import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { OutcomeKindSchema } from '@/lib/recommendations/types'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const CreateBodySchema = z.object({
  accountId: z.string().uuid().optional(),
  outcome: OutcomeKindSchema,
  note: z.string().trim().min(1).max(600).optional(),
  subjectType: z.string().trim().min(1).max(64).optional(),
  subjectId: z.string().trim().min(1).max(128).optional(),
  recommendationVersion: z.string().trim().min(1).max(64).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const url = new URL(request.url)
    const accountId = url.searchParams.get('accountId')

    await ensurePersonalWorkspace({ supabase, userId })
    const ws = await getCurrentWorkspace({ supabase, userId })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    let q = supabase
      .schema('api')
      .from('outcome_records')
      .select('id, account_id, outcome, note, subject_type, subject_id, recommendation_version, recorded_at, updated_at, actor_user_id')
      .eq('workspace_id', ws.id)
      .order('recorded_at', { ascending: false })
      .limit(50)

    if (accountId && accountId.trim()) q = q.eq('account_id', accountId.trim())

    const { data, error } = await q
    if (error) return fail(ErrorCode.DATABASE_ERROR, 'Load failed', undefined, undefined, bridge, requestId)

    return ok({ rows: data ?? [] }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/outcomes', userId, bridge, requestId)
  }
})

export const POST = withApiGuard(async (request: NextRequest, { requestId, userId, body }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const parsed = CreateBodySchema.safeParse(body)
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId })
    const ws = await getCurrentWorkspace({ supabase, userId })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { data: row, error } = await supabase
      .schema('api')
      .from('outcome_records')
      .insert({
        workspace_id: ws.id,
        actor_user_id: userId,
        account_id: parsed.data.accountId ?? null,
        outcome: parsed.data.outcome,
        note: parsed.data.note ?? null,
        subject_type: parsed.data.subjectType ?? null,
        subject_id: parsed.data.subjectId ?? null,
        recommendation_version: parsed.data.recommendationVersion ?? null,
        meta: parsed.data.meta ?? {},
      })
      .select('id, recorded_at')
      .single()

    if (error || !row) return fail(ErrorCode.DATABASE_ERROR, 'Save failed', undefined, undefined, bridge, requestId)

    await logAudit({
      supabase,
      workspaceId: ws.id,
      actorUserId: userId,
      action: 'outcome.recorded',
      targetType: 'account',
      targetId: parsed.data.accountId ?? null,
      meta: { outcome: parsed.data.outcome, subjectType: parsed.data.subjectType ?? null },
      request,
    })

    await logProductEvent({
      userId,
      eventName: 'outcome_recorded',
      eventProps: { workspaceId: ws.id, accountId: parsed.data.accountId ?? null, outcome: parsed.data.outcome },
    })

    return ok({ id: row.id, recordedAt: row.recorded_at }, { status: 201 }, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/outcomes', userId, bridge, requestId)
  }
})

