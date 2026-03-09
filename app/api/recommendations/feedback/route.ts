import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { FeedbackKindSchema } from '@/lib/recommendations/types'
import { RECOMMENDATION_ENGINE_VERSION } from '@/lib/recommendations/engine'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  targetType: z.enum(['account', 'workspace']),
  targetId: z.string().min(1).max(128),
  recommendationType: z.string().min(1).max(64),
  recommendationVersion: z.string().min(1).max(64).optional(),
  kind: FeedbackKindSchema,
  comment: z.string().trim().min(1).max(600).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
})

export const POST = withApiGuard(async (request: NextRequest, { requestId, userId, body }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
    }

    await ensurePersonalWorkspace({ supabase, userId })
    const ws = await getCurrentWorkspace({ supabase, userId })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const v = parsed.data.recommendationVersion ?? RECOMMENDATION_ENGINE_VERSION

    const { data: row, error } = await supabase
      .schema('api')
      .from('recommendation_feedback')
      .insert({
        workspace_id: ws.id,
        actor_user_id: userId,
        target_type: parsed.data.targetType,
        target_id: parsed.data.targetId,
        recommendation_type: parsed.data.recommendationType,
        recommendation_version: v,
        kind: parsed.data.kind,
        comment: parsed.data.comment ?? null,
        meta: parsed.data.meta ?? {},
      })
      .select('id, created_at')
      .single()

    if (error || !row) return fail(ErrorCode.DATABASE_ERROR, 'Save failed', undefined, undefined, bridge, requestId)

    await logAudit({
      supabase,
      workspaceId: ws.id,
      actorUserId: userId,
      action: 'recommendation.feedback_submitted',
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetType === 'account' ? parsed.data.targetId : null,
      meta: {
        recommendationType: parsed.data.recommendationType,
        kind: parsed.data.kind,
        version: v,
      },
      request,
    })

    await logProductEvent({
      userId,
      eventName: 'recommendation_feedback_submitted',
      eventProps: { targetType: parsed.data.targetType, recommendationType: parsed.data.recommendationType, kind: parsed.data.kind, version: v, workspaceId: ws.id },
    })

    return ok({ id: row.id, createdAt: row.created_at }, { status: 201 }, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/recommendations/feedback', userId, bridge, requestId)
  }
})

