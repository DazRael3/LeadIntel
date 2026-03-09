import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace } from '@/lib/team/workspace'
import { setCurrentWorkspace } from '@/lib/services/workspace-switching'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  workspaceId: z.string().uuid(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const switched = await setCurrentWorkspace({ supabase, userId: user.id, workspaceId: parsed.data.workspaceId })
      if (!switched.ok && switched.reason === 'not_member') {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }
      if (!switched.ok) {
        return fail(ErrorCode.INTERNAL_ERROR, 'Workspace switching unavailable', undefined, undefined, bridge, requestId)
      }

      await logAudit({
        supabase,
        workspaceId: parsed.data.workspaceId,
        actorUserId: user.id,
        action: 'workspace.switched',
        targetType: 'workspace',
        targetId: parsed.data.workspaceId,
        meta: {},
        request,
      })

      await logProductEvent({ userId: user.id, eventName: 'workspace_switched', eventProps: { workspaceId: parsed.data.workspaceId } })

      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/workspaces/switch', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

