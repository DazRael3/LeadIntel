import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies, updateWorkspacePolicies } from '@/lib/services/workspace-policies'
import { defaultWorkspacePolicies } from '@/lib/domain/workspace-policies'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) {
      return ok(
        {
          configured: false,
          reason: 'workspace_missing',
          workspace: { id: '', name: 'Workspace' },
          role: 'viewer',
          policies: defaultWorkspacePolicies(),
          updatedAt: null,
        },
        undefined,
        bridge,
        requestId
      )
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies, updatedAt } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })

    await logProductEvent({ userId: user.id, eventName: 'workspace_controls_viewed', eventProps: { workspaceId: ws.id } })

    return ok({ workspace: ws, role: membership.role, policies, updatedAt }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/policies', userId, bridge, requestId)
  }
})

export const POST = withApiGuard(async (request: NextRequest, { requestId, userId, body }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) {
      return fail(
        ErrorCode.VALIDATION_ERROR,
        'Workspace required',
        { workspace: 'Create or select a workspace before managing workspace policies.' },
        { status: 422 },
        bridge,
        requestId
      )
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    const updated = await updateWorkspacePolicies({ supabase, workspaceId: ws.id, userId: user.id, patch: body })

    await logAudit({
      supabase,
      workspaceId: ws.id,
      actorUserId: user.id,
      action: 'workspace.policy_updated',
      targetType: 'workspace',
      targetId: ws.id,
      meta: { patchKeys: Object.keys((body ?? {}) as Record<string, unknown>) },
      request,
    })

    await logProductEvent({
      userId: user.id,
      eventName: 'workflow_governance_updated',
      eventProps: { workspaceId: ws.id, keys: Object.keys((body ?? {}) as Record<string, unknown>) },
    })

    return ok({ policies: updated.policies, updatedAt: updated.updatedAt }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/policies', userId, bridge, requestId)
  }
})

