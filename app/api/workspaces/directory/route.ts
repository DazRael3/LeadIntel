import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace } from '@/lib/team/workspace'
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
    const workspaces = await listAccessibleWorkspaces({ supabase, userId: user.id })

    await logProductEvent({ userId: user.id, eventName: 'workspace_switcher_viewed', eventProps: { workspacesCount: workspaces.length } })

    return ok({ workspaces }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspaces/directory', userId, bridge, requestId)
  }
})

