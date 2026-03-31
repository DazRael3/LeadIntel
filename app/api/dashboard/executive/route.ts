import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { buildExecutiveSummary } from '@/lib/executive/engine'
import { logProductEvent } from '@/lib/services/analytics'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({
      userId: user.id,
      sessionEmail: user.email ?? null,
      supabase,
      capability: 'executive_dashboard',
    })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

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
            metrics: {
              actionQueueReady: 0,
              actionQueueBlocked: 0,
              approvalsPending: 0,
              deliveriesFailed7d: 0,
              strategicPrograms: 0,
            },
            highlights: [{ kind: 'positive', title: 'Not configured yet', detail: 'No workspace is selected for this session.' }],
            risks: [],
            limitationsNote:
              'Executive summaries are derived from workspace workflow objects. This workspace is not configured yet (no workspace selected).',
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
    if (!policies.reporting.executiveEnabled) {
      return ok(
        {
          configured: false,
          reason: 'disabled_by_policy',
          workspace: { id: ws.id, name: ws.name },
          role: membership.role,
          summary: {
            workspaceId: ws.id,
            computedAt: new Date().toISOString(),
            metrics: {
              actionQueueReady: 0,
              actionQueueBlocked: 0,
              approvalsPending: 0,
              deliveriesFailed7d: 0,
              strategicPrograms: 0,
            },
            highlights: [{ kind: 'positive', title: 'Disabled', detail: 'Executive reporting is disabled for this workspace by policy.' }],
            risks: [],
            limitationsNote:
              'Executive summaries are derived from workspace workflow objects. Executive reporting is disabled by policy for this workspace.',
          },
        },
        undefined,
        bridge,
        requestId
      )
    }

    const canView = policies.reporting.executiveViewerRoles.includes(membership.role)
    if (!canView) return fail(ErrorCode.FORBIDDEN, 'Manager access required', undefined, undefined, bridge, requestId)

    const summary = await buildExecutiveSummary({ supabase, workspaceId: ws.id })
    await logProductEvent({ userId: user.id, eventName: 'executive_dashboard_viewed', eventProps: { workspaceId: ws.id } })
    return ok({ workspace: { id: ws.id, name: ws.name }, role: membership.role, summary }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/dashboard/executive', userId, bridge, requestId)
  }
})

