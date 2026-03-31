import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { canManageExperiments, canViewGrowthInsights } from '@/lib/experiments/permissions'
import { getExperiment, updateExperiment } from '@/lib/services/experiments'
import { UpdateExperimentSchema } from '@/lib/experiments/schema'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const ParamsSchema = z.object({ experimentId: z.string().uuid() })

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'experiments' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const params = ParamsSchema.safeParse({ experimentId: request.nextUrl.pathname.split('/').pop() })
    if (!params.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid experiment id', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    if (!canViewGrowthInsights({ policies, role: membership.role })) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    const exp = await getExperiment({ supabase, workspaceId: ws.id, experimentId: params.data.experimentId })
    if (!exp) return fail(ErrorCode.NOT_FOUND, 'Experiment not found', undefined, undefined, bridge, requestId)
    return ok({ workspaceId: ws.id, experiment: exp }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/experiments/[id]', userId, bridge, requestId)
  }
})

export const PATCH = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'experiments' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const params = ParamsSchema.safeParse({ experimentId: request.nextUrl.pathname.split('/').pop() })
      if (!params.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid experiment id', undefined, undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      if (!canManageExperiments({ policies, role: membership.role })) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const parsed = UpdateExperimentSchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      const updated = await updateExperiment({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        experimentId: params.data.experimentId,
        patch: parsed.data,
      })

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'experiment.updated',
        targetType: 'workspace',
        targetId: ws.id,
        meta: { experimentKey: updated.key, status: updated.status, rolloutPercent: updated.rolloutPercent },
        request,
      })

      if (parsed.data.status) {
        const status = parsed.data.status
        const eventName =
          status === 'running'
            ? 'experiment_started'
            : status === 'paused'
              ? 'experiment_paused'
              : status === 'rolled_out'
                ? 'experiment_rolled_out'
                : status === 'reverted'
                  ? 'experiment_reverted'
                  : status === 'completed'
                    ? 'experiment_completed'
                    : null
        if (eventName) {
        await logProductEvent({
          userId: user.id,
            eventName,
            eventProps: { workspaceId: ws.id, experimentKey: updated.key, status },
        })
        }
      }

      return ok({ workspaceId: ws.id, experiment: updated }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/experiments/[id]', userId, bridge, requestId)
    }
  },
  { bodySchema: UpdateExperimentSchema }
)

