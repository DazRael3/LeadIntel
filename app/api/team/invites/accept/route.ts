import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { logAudit } from '@/lib/audit/log'
import { requireCapability } from '@/lib/billing/require-capability'

export const dynamic = 'force-dynamic'

const AcceptInviteBodySchema = z.object({
  token: z.string().min(8),
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

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'multi_workspace_controls' })
      if (!gate.ok) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const parsed = AcceptInviteBodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      const { data, error } = await supabase.rpc('accept_workspace_invite', { p_token: parsed.data.token })
      if (error || !data) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const workspaceId = String(data)
      await logAudit({
        supabase,
        workspaceId,
        actorUserId: user.id,
        action: 'invite.accepted',
        targetType: 'invite',
        targetId: null,
        meta: {},
        request,
      })

      return ok({ workspaceId }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/team/invites/accept', userId, bridge, requestId)
    }
  },
  { bodySchema: AcceptInviteBodySchema }
)

