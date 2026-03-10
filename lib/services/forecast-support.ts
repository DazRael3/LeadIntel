import type { SupabaseClient } from '@supabase/supabase-js'
import type { ForecastSupportSummary, ForecastSupportBucket } from '@/lib/revenue/types'

function bucket(args: {
  label: ForecastSupportBucket['label']
  title: string
  description: string
  queueItems: number
  delivered: number
  outcomes: number
  caution: string
}): ForecastSupportBucket {
  return {
    label: args.label,
    title: args.title,
    description: args.description,
    counts: { queueItems: args.queueItems, delivered: args.delivered, outcomes: args.outcomes },
    caution: args.caution,
  }
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export async function buildForecastSupportSummary(args: {
  supabase: SupabaseClient
  workspaceId: string
  windowDays: number
}): Promise<ForecastSupportSummary> {
  const computedAt = new Date().toISOString()
  const since = isoDaysAgo(Math.max(7, Math.min(90, Math.floor(args.windowDays))))

  const [queueRes, deliveryRes, outcomesRes] = await Promise.all([
    args.supabase
      .schema('api')
      .from('action_queue_items')
      .select('id, status, created_at')
      .eq('workspace_id', args.workspaceId)
      .gte('created_at', since)
      .limit(1000),
    args.supabase
      .schema('api')
      .from('action_deliveries')
      .select('id, status, created_at')
      .eq('workspace_id', args.workspaceId)
      .gte('created_at', since)
      .limit(1000),
    args.supabase
      .schema('api')
      .from('outcome_records')
      .select('id, outcome, recorded_at')
      .eq('workspace_id', args.workspaceId)
      .gte('recorded_at', since)
      .limit(1000),
  ])

  const queue = queueRes.data ?? []
  const deliveries = deliveryRes.data ?? []
  const outcomes = outcomesRes.data ?? []

  const delivered = deliveries.filter((r) => (r as { status?: unknown }).status === 'delivered').length
  const queuedOrReady = queue.filter((r) => {
    const s = (r as { status?: unknown }).status
    return s === 'ready' || s === 'queued' || s === 'processing'
  }).length

  const confirmedOutcomes = outcomes.filter((r) => {
    const o = (r as { outcome?: unknown }).outcome
    return o === 'meeting_booked' || o === 'qualified' || o === 'opportunity_created'
  }).length

  // Directional buckets: these are workflow support signals, not revenue commits.
  const buckets: ForecastSupportBucket[] = [
    bucket({
      label: 'strong_workflow_support',
      title: 'Strong workflow support',
      description: 'Delivered handoffs and confirmed outcomes exist in the window.',
      queueItems: queuedOrReady,
      delivered,
      outcomes: confirmedOutcomes,
      caution: 'These are observed workflow signals, not forecast commitments.',
    }),
    bucket({
      label: 'may_contribute_with_follow_through',
      title: 'May contribute with follow-through',
      description: 'Prepared/queued actions exist but outcomes are not confirmed yet.',
      queueItems: queuedOrReady,
      delivered,
      outcomes: confirmedOutcomes,
      caution: 'Focus on follow-through and owner routing; avoid over-weighting thin evidence.',
    }),
    bucket({
      label: 'early_thin_evidence',
      title: 'Early / thin evidence',
      description: 'Activity exists but is not yet supported by delivery or outcomes.',
      queueItems: queue.length,
      delivered,
      outcomes: confirmedOutcomes,
      caution: 'Treat as early signals; do not assume pipeline impact.',
    }),
    bucket({
      label: 'fading_signal_quality',
      title: 'Fading signal quality',
      description: 'Signals and actions appear older or stalled inside the window.',
      queueItems: queue.length,
      delivered,
      outcomes: confirmedOutcomes,
      caution: 'Re-check timing and data quality before investing deeper time.',
    }),
  ]

  return {
    type: 'manager_planning_summary',
    workspaceId: args.workspaceId,
    accountId: null,
    window: '30d',
    version: 'forecast_v1',
    computedAt,
    confidence: 'usable',
    reasonSummary: 'Directional workflow support summary for planning discussions.',
    signals: [
      { label: 'Action queue activity', detail: `${queue.length} queue items observed`, observed: true },
      { label: 'Deliveries', detail: `${delivered} delivered actions observed`, observed: true },
      { label: 'Outcomes', detail: `${confirmedOutcomes} confirmed progression outcomes recorded`, observed: true },
    ],
    limitationsNote: 'This is directional workflow support, not revenue forecasting or attribution.',
    buckets,
  }
}

