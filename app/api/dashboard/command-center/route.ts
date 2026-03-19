import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { buildCommandCenter } from '@/lib/services/command-center'
import { logProductEvent } from '@/lib/services/analytics'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(20).max(200).optional().default(120),
})

export const GET = withApiGuard(
  async (request: NextRequest, { requestId, userId, query }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = QuerySchema.safeParse(query ?? {})
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
              lanes: { act_now: [], review_needed: [], blocked: [], waiting: [], stale: [] },
              limitationsNote: 'Command Center is not configured yet (no workspace selected).',
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
      if (!policies.reporting.commandCenterEnabled) {
        return ok(
          {
            configured: false,
            reason: 'disabled_by_policy',
            workspace: { id: ws.id, name: ws.name },
            role: membership.role,
            summary: {
              workspaceId: ws.id,
              computedAt: new Date().toISOString(),
              lanes: { act_now: [], review_needed: [], blocked: [], waiting: [], stale: [] },
              limitationsNote: 'Command Center is disabled for this workspace by policy.',
            },
          },
          undefined,
          bridge,
          requestId
        )
      }
      if (!policies.reporting.commandViewerRoles.includes(membership.role)) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const summary = await buildCommandCenter({ supabase, workspaceId: ws.id, limit: parsed.data.limit })
      await logProductEvent({ userId: user.id, eventName: 'command_center_viewed', eventProps: { workspaceId: ws.id } })
      return ok({ workspace: { id: ws.id, name: ws.name }, role: membership.role, summary }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/dashboard/command-center', userId, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

