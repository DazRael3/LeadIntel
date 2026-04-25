import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
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

function parseIsoDate(value: string): Date | null {
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return new Date(ms)
}

function toIsoDay(value: string): string | null {
  const date = parseIsoDate(value)
  if (!date) return null
  return date.toISOString().slice(0, 10)
}

function estimateRevenueFromEventProps(eventProps: unknown): number {
  if (!eventProps || typeof eventProps !== 'object') return 79
  const props = eventProps as Record<string, unknown>
  const explicitAmount = props.amount
  if (typeof explicitAmount === 'number' && Number.isFinite(explicitAmount) && explicitAmount >= 0) {
    return explicitAmount
  }

  const tier = typeof props.subscriptionTier === 'string' ? props.subscriptionTier : null
  if (!tier) return 79
  if (tier === 'team') return 249
  if (tier === 'closer_plus') return 149
  if (tier === 'pro' || tier === 'closer' || tier === 'starter') return 79
  return 79
}

export const GET = withApiGuard(
  async (request: NextRequest, { requestId, userId, query }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'experiments' })
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
        .select('event_name, user_id, created_at, event_props')
        .eq('workspace_id', ws.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000)

      const eventsAgg: Record<string, number> = {}
      const activeUsers = new Set<string>()
      const revenueByDay = new Map<string, number>()
      for (const row of (growthEvents ?? []) as Array<{
        event_name?: unknown
        user_id?: unknown
        created_at?: unknown
        event_props?: unknown
      }>) {
        const name = typeof row.event_name === 'string' ? row.event_name : null
        if (!name) continue
        eventsAgg[name] = (eventsAgg[name] ?? 0) + 1
        const userId = typeof row.user_id === 'string' ? row.user_id : null
        if (userId) activeUsers.add(userId)

        if (name === 'payment_completed') {
          const createdAt = typeof row.created_at === 'string' ? row.created_at : null
          if (!createdAt) continue
          const day = toIsoDay(createdAt)
          if (!day) continue
          const amount = estimateRevenueFromEventProps(row.event_props)
          revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + amount)
        }
      }

      const pageViews = eventsAgg.page_view ?? 0
      const demoStarts = eventsAgg.demo_started ?? 0
      const paymentCompleted = eventsAgg.payment_completed ?? 0
      const funnelBase = pageViews > 0 ? pageViews : demoStarts
      const conversionRatePct = funnelBase > 0 ? (paymentCompleted / funnelBase) * 100 : 0

      const sinceDate = parseIsoDate(since) ?? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
      const today = new Date()
      const revenueTrend: Array<{ date: string; revenue: number }> = []
      for (
        let cursor = new Date(Date.UTC(sinceDate.getUTCFullYear(), sinceDate.getUTCMonth(), sinceDate.getUTCDate()));
        cursor <= today;
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
      ) {
        const day = cursor.toISOString().slice(0, 10)
        revenueTrend.push({
          date: day,
          revenue: revenueByDay.get(day) ?? 0,
        })
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
          conversionRatePct: Number.parseFloat(conversionRatePct.toFixed(2)),
          activeUsers: activeUsers.size,
          revenueTrend,
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

