import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountExplainability } from '@/lib/data/getAccountExplainability'
import type { OutcomeKind } from '@/lib/recommendations/types'
import type { PipelineInfluenceSummary } from '@/lib/revenue/types'
import { deriveRevenueConfidence } from '@/lib/revenue/confidence'
import { observedVsInferredSignals, planningReasonSummary } from '@/lib/revenue/explanations'
import { derivePipelineInfluenceLabel } from '@/lib/revenue/influence'

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function windowToDays(window: '7d' | '30d' | '90d' | 'all'): number {
  if (window === '7d') return 7
  if (window === '90d') return 90
  if (window === 'all') return 90
  return 30
}

type OutcomeRow = { outcome: string; recorded_at: string }

export async function buildPipelineInfluenceSummary(args: {
  supabase: SupabaseClient
  workspaceId: string
  accountId: string
  window: '7d' | '30d' | '90d' | 'all'
  ex: AccountExplainability
}): Promise<PipelineInfluenceSummary> {
  const computedAt = new Date().toISOString()
  const conf = deriveRevenueConfidence(args.ex)

  const since = isoDaysAgo(windowToDays(args.window))

  const [queueRes, deliveryRes, outcomesRes] = await Promise.all([
    args.supabase
      .schema('api')
      .from('action_queue_items')
      .select('id, action_type, status, created_at')
      .eq('workspace_id', args.workspaceId)
      .eq('lead_id', args.accountId)
      .gte('created_at', since)
      .limit(100),
    args.supabase
      .schema('api')
      .from('action_deliveries')
      .select('id, status, created_at')
      .eq('workspace_id', args.workspaceId)
      .gte('created_at', since)
      .limit(200),
    args.supabase
      .schema('api')
      .from('outcome_records')
      .select('outcome, recorded_at')
      .eq('workspace_id', args.workspaceId)
      .eq('account_id', args.accountId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .limit(25),
  ])

  const preparedActionsCount = (queueRes.data ?? []).filter((r) => (r as { status?: unknown }).status === 'ready').length
  const deliveredActionsCount = (deliveryRes.data ?? []).filter((r) => (r as { status?: unknown }).status === 'delivered').length

  const outcomes: OutcomeKind[] = (outcomesRes.data ?? [])
    .map((r) => (r as unknown as OutcomeRow).outcome)
    .filter((x): x is OutcomeKind => typeof x === 'string')
    .filter((x) =>
      x === 'no_outcome_yet' ||
      x === 'replied' ||
      x === 'meeting_booked' ||
      x === 'qualified' ||
      x === 'opportunity_created' ||
      x === 'not_a_fit' ||
      x === 'wrong_timing' ||
      x === 'no_response' ||
      x === 'manual_dismissal'
    )

  const influence = derivePipelineInfluenceLabel({
    hasFirstParty: args.ex.firstPartyIntent.summary.label !== 'none',
    momentumLabel: args.ex.momentum.label,
    deliveredActionsCount,
    preparedActionsCount,
    outcomes,
    dataQuality: args.ex.dataQuality.quality,
    freshness: args.ex.dataQuality.freshness,
  })

  const whatIsMissing = influence.missing

  const limitations = conf.limitationsNote
    ? `${conf.limitationsNote} Influence states reflect workflow signals, not revenue attribution.`
    : 'Influence states reflect workflow signals, not revenue attribution.'

  return {
    type: 'pipeline_influence',
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    window: args.window,
    version: 'influence_v1',
    computedAt,
    confidence: conf.label,
    reasonSummary: planningReasonSummary(args.ex),
    signals: observedVsInferredSignals(args.ex),
    limitationsNote: limitations,
    influence: influence.label,
    whatIsMissing,
  }
}

