import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { UpdateApprovalSchema } from '@/lib/domain/approvals'
import { setApprovalStatus } from '@/lib/services/approvals'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

export const PATCH = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({
        userId: user.id,
        sessionEmail: user.email ?? null,
        supabase,
        capability: 'approvals',
      })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = UpdateApprovalSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const updated = await setApprovalStatus({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        approvalId: parsed.data.id,
        status: parsed.data.status,
        note: parsed.data.note ?? null,
      })

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'approval.reviewed',
        targetType: updated.target_type,
        targetId: updated.target_id,
        meta: { approvalId: updated.id, status: updated.status },
        request,
      })

      return ok({ approval: updated }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/team/approvals/item', userId, bridge, requestId)
    }
  },
  { bodySchema: UpdateApprovalSchema }
)

