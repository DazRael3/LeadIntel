import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { revenueIntelligenceEnabled, canVerifyRevenueLinkage } from '@/lib/services/revenue-governance'
import { createVerificationReview, CreateVerificationReviewSchema, listVerificationReviews } from '@/lib/services/outcome-verification'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'revenue_intelligence' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    const enabled = revenueIntelligenceEnabled({ policies, role: membership.role })
    if (!enabled.ok) return fail(ErrorCode.FORBIDDEN, enabled.reason, undefined, undefined, bridge, requestId)

    const [reviews, { data: mappingQueue }] = await Promise.all([
      listVerificationReviews({ supabase, workspaceId: ws.id, limit: 100 }),
      supabase
        .schema('api')
        .from('crm_object_mappings')
        .select('id, mapping_kind, crm_system, crm_object_id, verification_status, status, account_id, updated_at')
        .eq('workspace_id', ws.id)
        .in('verification_status', ['needs_review', 'unverified', 'ambiguous'])
        .order('updated_at', { ascending: false })
        .limit(100),
    ])

    await logProductEvent({ userId: user.id, eventName: 'verification_queue_viewed', eventProps: { workspaceId: ws.id, count: reviews.length } })

    return ok({ workspaceId: ws.id, queue: { crmMappings: mappingQueue ?? [] }, reviews }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/revenue/verification', userId, bridge, requestId)
  }
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'revenue_intelligence' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      const enabled = revenueIntelligenceEnabled({ policies, role: membership.role })
      if (!enabled.ok) return fail(ErrorCode.FORBIDDEN, enabled.reason, undefined, undefined, bridge, requestId)

      const canVerify = canVerifyRevenueLinkage({ policies, role: membership.role })
      if (!canVerify.ok) return fail(ErrorCode.FORBIDDEN, canVerify.reason, undefined, undefined, bridge, requestId)

      const parsed = CreateVerificationReviewSchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      const review = await createVerificationReview({ supabase, workspaceId: ws.id, actorUserId: user.id, input: parsed.data })

      // If verifying a CRM mapping, update its verification_status to match (best-effort).
      // (This makes the queue shrink and keeps verification state visible on account cards.)
      try {
        if (parsed.data.targetType === 'crm_mapping') {
          const next =
            parsed.data.status === 'verified'
              ? 'verified'
              : parsed.data.status === 'ambiguous'
                ? 'ambiguous'
                : parsed.data.status === 'not_linked'
                  ? 'not_linked'
                  : 'needs_review'
          await supabase
            .schema('api')
            .from('crm_object_mappings')
            .update({ verification_status: next, updated_by: user.id, updated_at: new Date().toISOString() })
            .eq('workspace_id', ws.id)
            .eq('id', parsed.data.targetId)
        }
      } catch {
        // best-effort
      }

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'revenue.linkage_verified',
        targetType: 'workspace',
        targetId: ws.id,
        meta: { targetType: review.target_type, status: review.status, targetId: review.target_id },
        request,
      })

      const eventName =
        review.status === 'verified'
          ? 'linkage_verified'
          : review.status === 'ambiguous'
            ? 'linkage_marked_ambiguous'
            : review.status === 'not_linked'
              ? 'linkage_marked_not_linked'
              : 'linkage_marked_needs_review_later'

      await logProductEvent({
        userId: user.id,
        eventName,
        eventProps: { workspaceId: ws.id, targetType: review.target_type, targetId: review.target_id },
      })

      return ok({ workspaceId: ws.id, review }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/revenue/verification', userId, bridge, requestId)
    }
  },
  { bodySchema: CreateVerificationReviewSchema }
)

