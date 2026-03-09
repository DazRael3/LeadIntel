import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace, getCurrentWorkspace } from '@/lib/team/workspace'
import { logAudit } from '@/lib/audit/log'
import { requireTeamPlan } from '@/lib/team/gating'
import { enqueueWebhookEvent } from '@/lib/integrations/webhooks'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'manager', 'rep', 'viewer']),
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }
      const user = await getUserSafe(supabase)
      if (!user) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) {
        return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)
      }

      const { error } = await supabase.rpc('set_workspace_member_role', {
        p_workspace_id: workspace.id,
        p_user_id: parsed.data.userId,
        p_role: parsed.data.role,
      })

      if (error) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'member.role_changed',
        targetType: 'member',
        targetId: parsed.data.userId,
        meta: { role: parsed.data.role },
        request,
      })

      await enqueueWebhookEvent({
        workspaceId: workspace.id,
        eventType: 'member.role_changed',
        eventId: randomUUID(),
        payload: {
          workspaceId: workspace.id,
          userId: parsed.data.userId,
          role: parsed.data.role,
          changedAt: new Date().toISOString(),
        },
      })

      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/team/members/role', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

