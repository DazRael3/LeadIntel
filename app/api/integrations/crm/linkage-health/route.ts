import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { revenueIntelligenceEnabled } from '@/lib/services/revenue-governance'
import { getCrmLinkageHealth } from '@/lib/services/crm-linkage-health'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'integration_destination_health' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) {
      return ok({ configured: false, reason: 'workspace_missing', workspaceId: null, health: null }, undefined, bridge, requestId)
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    const enabled = revenueIntelligenceEnabled({ policies, role: membership.role })
    if (!enabled.ok) {
      return ok({ configured: false, reason: enabled.reason, workspaceId: ws.id, health: null }, undefined, bridge, requestId)
    }

    const health = await getCrmLinkageHealth({ supabase, workspaceId: ws.id })

    await logProductEvent({ userId: user.id, eventName: 'crm_linkage_health_viewed', eventProps: { workspaceId: ws.id } })

    return ok({ workspaceId: ws.id, health }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/integrations/crm/linkage-health', userId, bridge, requestId)
  }
})

