import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { revenueIntelligenceEnabled } from '@/lib/services/revenue-governance'
import { buildAttributionSupportSummary } from '@/lib/services/attribution-support'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  windowDays: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      if (!v) return undefined
      const n = Number.parseInt(v, 10)
      return Number.isFinite(n) ? n : undefined
    }),
})

function accountIdFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  const id = parts.at(-2)
  return typeof id === 'string' && id.length > 0 ? id : null
}

export const GET = withApiGuard(
  async (request: NextRequest, { requestId, userId }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const url = new URL(request.url)
      const parsed = QuerySchema.safeParse({ windowDays: url.searchParams.get('windowDays') ?? undefined })
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid query params', parsed.error.flatten(), { status: 400 }, bridge, requestId)

      const accountId = accountIdFromPath(url.pathname)
      if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      const enabled = revenueIntelligenceEnabled({ policies, role: membership.role })
      if (!enabled.ok) return fail(ErrorCode.FORBIDDEN, enabled.reason, undefined, undefined, bridge, requestId)

      const windowDays = typeof parsed.data.windowDays === 'number' ? parsed.data.windowDays : policies.revenueIntelligence.defaultLinkageWindowDays

      const summary = await buildAttributionSupportSummary({
        supabase,
        workspaceId: ws.id,
        accountId,
        windowDays,
        attributionEnabled: policies.revenueIntelligence.attributionSupportEnabled,
        ambiguousVisible: policies.revenueIntelligence.ambiguousVisibleToViewerRoles,
      })

      await logProductEvent({
        userId: user.id,
        eventName: 'attribution_support_viewed',
        eventProps: { workspaceId: ws.id, accountId, windowDays },
      })

      return ok(summary, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/accounts/[accountId]/attribution-support', userId, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

