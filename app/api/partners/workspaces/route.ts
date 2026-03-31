import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace } from '@/lib/team/workspace'
import { listAccessibleWorkspaces } from '@/lib/services/workspace-directory'
import { getWorkspaceHealthSummary } from '@/lib/services/workspace-health-summary'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'multi_workspace_controls' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const current = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!current) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const workspaces = await listAccessibleWorkspaces({ supabase, userId: user.id })
    const limited = workspaces.slice(0, 30)
    const summaries = await Promise.all(
      limited.map(async (w) => {
        const health = await getWorkspaceHealthSummary({ supabase, workspaceId: w.workspace.id })
        return { ...w, health }
      })
    )

    await logProductEvent({ userId: user.id, eventName: 'partner_dashboard_viewed', eventProps: { workspacesCount: summaries.length } })

    return ok({ currentWorkspaceId: current.id, workspaces: summaries }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/partners/workspaces', userId, bridge, requestId)
  }
})

