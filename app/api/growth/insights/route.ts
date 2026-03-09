import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { canViewGrowthInsights } from '@/lib/experiments/permissions'
import { listExperiments } from '@/lib/services/experiments'
import { computeDirectionalExperimentResults } from '@/lib/services/experiment-results'
import { deriveWorkspaceLifecycleSummary } from '@/lib/services/lifecycle-state'
import { deriveWorkspaceRetentionSignals } from '@/lib/services/retention-signals'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  windowDays: z.string().optional(),
})

function parseWindowDays(raw: string | undefined): number {
  const n = Number.parseInt((raw ?? '').trim(), 10)
  if (!Number.isFinite(n)) return 30
  return Math.max(7, Math.min(90, n))
}

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

      const q = QuerySchema.safeParse(query ?? {})
      const windowDays = parseWindowDays(q.success ? q.data.windowDays : undefined)
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      if (!canViewGrowthInsights({ policies, role: membership.role })) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const experiments = await listExperiments({ supabase, workspaceId: ws.id })

      const { data: exposures } = await supabase
        .schema('api')
        .from('experiment_exposures')
        .select('experiment_key, variant_key, created_at')
        .eq('workspace_id', ws.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000)

      const exposuresAgg: Record<string, { total: number; byVariant: Record<string, number> }> = {}
      for (const row of (exposures ?? []) as Array<{ experiment_key?: unknown; variant_key?: unknown }>) {
        const ek = typeof row.experiment_key === 'string' ? row.experiment_key : null
        const vk = typeof row.variant_key === 'string' ? row.variant_key : null
        if (!ek || !vk) continue
        if (!exposuresAgg[ek]) exposuresAgg[ek] = { total: 0, byVariant: {} }
        exposuresAgg[ek]!.total += 1
        exposuresAgg[ek]!.byVariant[vk] = (exposuresAgg[ek]!.byVariant[vk] ?? 0) + 1
      }

      const { data: growthEvents } = await supabase
        .schema('api')
        .from('growth_events')
        .select('event_name, created_at')
        .eq('workspace_id', ws.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000)

      const eventsAgg: Record<string, number> = {}
      for (const row of (growthEvents ?? []) as Array<{ event_name?: unknown }>) {
        const name = typeof row.event_name === 'string' ? row.event_name : null
        if (!name) continue
        eventsAgg[name] = (eventsAgg[name] ?? 0) + 1
      }

      const directionalResults = await computeDirectionalExperimentResults({
        supabase,
        workspaceId: ws.id,
        experiments,
        sinceIso: since,
        windowDays,
      })

      const [lifecycle, retention] = await Promise.all([
        deriveWorkspaceLifecycleSummary({ supabase, workspaceId: ws.id }),
        deriveWorkspaceRetentionSignals({ supabase, workspaceId: ws.id }),
      ])

      return ok(
        {
          workspaceId: ws.id,
          windowDays,
          since,
          experiments,
          exposures: exposuresAgg,
          growthEventCounts: eventsAgg,
          directionalResults,
          lifecycle,
          retention,
          note: 'Counts are directional operational signals (events and deduped exposures), not statistical significance.',
        },
        undefined,
        bridge,
        requestId
      )
    } catch (e) {
      return asHttpError(e, '/api/growth/insights', userId, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

