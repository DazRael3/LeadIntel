import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { listAccessibleWorkspaces } from '@/lib/services/workspace-directory'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const cap = await requireCapability({
      userId: user.id,
      sessionEmail: user.email ?? null,
      supabase,
      capability: 'multi_workspace_controls',
    })

    // Non-Team tiers still need a stable current workspace context, but should not
    // discover or switch into multiple workspaces.
    if (!cap.ok) {
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return ok({ workspaces: [] }, undefined, bridge, requestId)
      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      return ok(
        {
          workspaces: [
            {
              workspace: { id: ws.id, name: ws.name, owner_user_id: ws.owner_user_id, created_at: ws.created_at, default_template_set_id: ws.default_template_set_id },
              role: membership?.role ?? 'viewer',
              source: 'direct',
            },
          ],
        },
        undefined,
        bridge,
        requestId
      )
    }

    const workspaces = await listAccessibleWorkspaces({ supabase, userId: user.id })

    await logProductEvent({ userId: user.id, eventName: 'workspace_switcher_viewed', eventProps: { workspacesCount: workspaces.length } })

    return ok({ workspaces }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspaces/directory', userId, bridge, requestId)
  }
})

