import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExperimentDefinition } from '@/lib/experiments/types'
import type { DirectionalExperimentResults, DirectionalMetricCounts } from '@/lib/domain/experiment-results'

type ExposureRow = { experiment_key: string; variant_key: string }
type GrowthEventRow = { event_name: string; event_props: unknown }

function metricCounts(args: {
  metric: string
  events: GrowthEventRow[]
  experimentKey: string
}): DirectionalMetricCounts {
  const byVariant: Record<string, number> = {}
  let total = 0
  for (const e of args.events) {
    if (e.event_name !== args.metric) continue
    const props = e.event_props
    if (!props || typeof props !== 'object') continue
    const p = props as Record<string, unknown>
    const ek = typeof p.experimentKey === 'string' ? p.experimentKey : null
    const vk = typeof p.variantKey === 'string' ? p.variantKey : null
    if (!ek || !vk) continue
    if (ek !== args.experimentKey) continue
    total += 1
    byVariant[vk] = (byVariant[vk] ?? 0) + 1
  }
  return { metric: args.metric, byVariant, total }
}

export async function computeDirectionalExperimentResults(args: {
  supabase: SupabaseClient
  workspaceId: string
  experiments: ExperimentDefinition[]
  sinceIso: string
  windowDays: number
}): Promise<DirectionalExperimentResults[]> {
  const keys = new Set(args.experiments.map((e) => e.key))

  const [{ data: exposureRows }, { data: growthRows }] = await Promise.all([
    args.supabase
      .schema('api')
      .from('experiment_exposures')
      .select('experiment_key, variant_key')
      .eq('workspace_id', args.workspaceId)
      .gte('created_at', args.sinceIso)
      .order('created_at', { ascending: false })
      .limit(8000),
    args.supabase
      .schema('api')
      .from('growth_events')
      .select('event_name, event_props')
      .eq('workspace_id', args.workspaceId)
      .gte('created_at', args.sinceIso)
      .order('created_at', { ascending: false })
      .limit(8000),
  ])

  const exposuresAgg: Record<string, { total: number; byVariant: Record<string, number> }> = {}
  for (const row of (exposureRows ?? []) as unknown as ExposureRow[]) {
    if (!keys.has(row.experiment_key)) continue
    if (!exposuresAgg[row.experiment_key]) exposuresAgg[row.experiment_key] = { total: 0, byVariant: {} }
    exposuresAgg[row.experiment_key]!.total += 1
    exposuresAgg[row.experiment_key]!.byVariant[row.variant_key] = (exposuresAgg[row.experiment_key]!.byVariant[row.variant_key] ?? 0) + 1
  }

  const events = (growthRows ?? []) as unknown as GrowthEventRow[]

  const out: DirectionalExperimentResults[] = []
  for (const exp of args.experiments) {
    const exposure = exposuresAgg[exp.key] ?? { total: 0, byVariant: {} }
    const primary = (exp.primaryMetrics ?? []).map((m) => metricCounts({ metric: m, events, experimentKey: exp.key }))
    const secondary = (exp.secondaryMetrics ?? []).map((m) => metricCounts({ metric: m, events, experimentKey: exp.key }))
    out.push({
      experimentKey: exp.key,
      windowDays: args.windowDays,
      exposures: exposure,
      primaryMetrics: primary,
      secondaryMetrics: secondary,
      note: 'Directional counts only. Do not interpret as statistically significant without appropriate analysis.',
    })
  }
  return out
}

