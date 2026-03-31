import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { buildWeeklyPlanningSummary } from '@/lib/services/team-planning'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(25).max(200).optional().default(100),
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

    const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) {
      return ok(
        {
          configured: false,
          reason: 'workspace_missing',
          workspace: { id: '', name: 'Workspace' },
          role: 'viewer',
          summary: {
            workspaceId: 'missing',
            computedAt: new Date().toISOString(),
            buckets: { workNow: [], blocked: [], waitingOnReview: [], needsFollowThrough: [], deliveredRecently: [] },
          },
        },
        undefined,
        bridge,
        requestId
      )
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    if (!policies.planning.planningIntelligenceEnabled) {
      return ok(
        {
          configured: false,
          reason: 'disabled_by_policy',
          workspace: { id: ws.id, name: ws.name },
          role: membership.role,
          summary: {
            workspaceId: ws.id,
            computedAt: new Date().toISOString(),
            buckets: { workNow: [], blocked: [], waitingOnReview: [], needsFollowThrough: [], deliveredRecently: [] },
          },
        },
        undefined,
        bridge,
        requestId
      )
    }

    const summary = await buildWeeklyPlanningSummary({ supabase, workspaceId: ws.id, viewerUserId: user.id, limit: parsed.data.limit })

    await logProductEvent({ userId: user.id, eventName: 'weekly_planning_board_viewed', eventProps: { workspaceId: ws.id, limit: parsed.data.limit } })

    return ok({ workspace: { id: ws.id, name: ws.name }, role: membership.role, summary }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/team/planning', userId, bridge, requestId)
  }
})

