import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { buildAdoptionHealthSummary } from '@/lib/services/adoption-health'
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

export const GET = withApiGuard(
  async (request: NextRequest, { requestId, userId }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'partner_dashboard' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const url = new URL(request.url)
      const parsed = QuerySchema.safeParse({ windowDays: url.searchParams.get('windowDays') ?? undefined })
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid query params', parsed.error.flatten(), { status: 400 }, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const windowDays = typeof parsed.data.windowDays === 'number' ? parsed.data.windowDays : 30
      const summary = await buildAdoptionHealthSummary({ supabase, workspaceId: ws.id, userId: user.id, windowDays })

      await logProductEvent({ userId: user.id, eventName: 'workspace_health_viewed', eventProps: { workspaceId: ws.id, windowDays } })

      return ok(summary, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/customer-success/health', userId, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

