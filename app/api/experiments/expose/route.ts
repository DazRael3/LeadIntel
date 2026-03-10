import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan, getUserTierForGating } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { exposureLoggingEnabled } from '@/lib/experiments/guards'
import { evaluateExperiment } from '@/lib/experiments/engine'
import { exposureEventProps } from '@/lib/experiments/exposure'
import { listExperiments } from '@/lib/services/experiments'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  experimentKey: z.string().trim().min(1).max(64),
  surface: z.string().trim().min(1).max(64),
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = BodySchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      const plan = tier

      const experiments = await listExperiments({ supabase, workspaceId: ws.id })
      const exp = experiments.find((e) => e.key === parsed.data.experimentKey) ?? null
      if (!exp) {
        return ok(
          {
            workspaceId: ws.id,
            assignment: {
              experimentKey: parsed.data.experimentKey,
              variantKey: 'control',
              source: 'disabled',
              reason: 'invalid_definition',
            },
          },
          undefined,
          bridge,
          requestId
        )
      }

      if (exp.surface !== parsed.data.surface) {
        return ok(
          {
            workspaceId: ws.id,
            assignment: {
              experimentKey: exp.key,
              variantKey: 'control',
              source: 'disabled',
              reason: 'surface_not_allowed',
            },
          },
          undefined,
          bridge,
          requestId
        )
      }

      const seed = (process.env.EXPERIMENT_ASSIGNMENT_SEED ?? process.env.DEV_SEED_SECRET ?? 'leadintel').trim() || 'leadintel'

      const assignment = evaluateExperiment({
        policies,
        experiment: exp,
        context: {
          userId: user.id,
          workspaceId: ws.id,
          workspaceRole: membership.role,
          plan,
          surface: parsed.data.surface,
          unitType: exp.unitType,
          unitId: exp.unitType === 'workspace' ? ws.id : user.id,
        },
        seed,
      })

      if (exposureLoggingEnabled(policies) && assignment.source === 'experiment') {
        // Best-effort: write deduped exposure row.
        await supabase
          .schema('api')
          .from('experiment_exposures')
          .upsert(
            {
              workspace_id: ws.id,
              experiment_id: exp.id,
              experiment_key: exp.key,
              variant_key: assignment.variantKey,
              unit_type: exp.unitType,
              unit_id: exp.unitType === 'workspace' ? ws.id : user.id,
              actor_user_id: user.id,
              surface: parsed.data.surface,
              context: { plan, role: membership.role },
            },
            { onConflict: 'workspace_id,experiment_key,unit_type,unit_id' }
          )

        await logProductEvent({
          userId: user.id,
          eventName: 'experiment_exposed',
          eventProps: exposureEventProps({
            assignment,
            context: {
              userId: user.id,
              workspaceId: ws.id,
              workspaceRole: membership.role,
              plan,
              surface: parsed.data.surface,
              unitType: exp.unitType,
              unitId: exp.unitType === 'workspace' ? ws.id : user.id,
            },
          }),
        })
      }

      return ok({ workspaceId: ws.id, assignment }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/experiments/expose', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

