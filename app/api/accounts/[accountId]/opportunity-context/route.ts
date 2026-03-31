import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { revenueIntelligenceEnabled } from '@/lib/services/revenue-governance'
import { getOpportunityContext } from '@/lib/services/opportunity-context'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

function accountIdFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  const id = parts.at(-2)
  return typeof id === 'string' && id.length > 0 ? id : null
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'revenue_intelligence' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const accountId = accountIdFromPath(new URL(request.url).pathname)
    if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    const enabled = revenueIntelligenceEnabled({ policies, role: membership.role })
    if (!enabled.ok) return fail(ErrorCode.FORBIDDEN, enabled.reason, undefined, undefined, bridge, requestId)

    const ctx = await getOpportunityContext({ supabase, workspaceId: ws.id, accountId })

    await logProductEvent({
      userId: user.id,
      eventName: 'opportunity_context_viewed',
      eventProps: { workspaceId: ws.id, accountId },
    })

    return ok(ctx, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/accounts/[accountId]/opportunity-context', userId, bridge, requestId)
  }
})

