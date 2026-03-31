import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { getAccountRevenueIntelligence } from '@/lib/revenue/engine'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'planning_intelligence' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const url = new URL(request.url)
    const accountId = url.pathname.split('/').filter(Boolean).at(-2)
    if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    if (!policies.planning.planningIntelligenceEnabled) {
      return fail(ErrorCode.FORBIDDEN, 'Planning intelligence is disabled for this workspace', undefined, undefined, bridge, requestId)
    }

    const intel = await getAccountRevenueIntelligence({
      supabase,
      userId: user.id,
      workspaceId: ws.id,
      accountId,
      window: parsed.data.window,
    })
    if (!intel) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)

    await logProductEvent({ userId: user.id, eventName: 'account_plan_viewed', eventProps: { workspaceId: ws.id, accountId, window: parsed.data.window } })
    await logProductEvent({
      userId: user.id,
      eventName: 'follow_through_viewed',
      eventProps: { workspaceId: ws.id, accountId, window: parsed.data.window },
    })

    return ok(
      {
        workspaceId: ws.id,
        role: membership.role,
        plan: intel.plan,
        followThrough: intel.followThrough,
      },
      undefined,
      bridge,
      requestId
    )
  } catch (e) {
    return asHttpError(e, '/api/accounts/[accountId]/plan', userId, bridge, requestId)
  }
})

