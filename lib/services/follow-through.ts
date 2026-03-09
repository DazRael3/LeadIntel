import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountExplainability } from '@/lib/data/getAccountExplainability'
import type { FollowThroughSummary, FollowThroughLabel } from '@/lib/revenue/types'
import { deriveRevenueConfidence } from '@/lib/revenue/confidence'
import { observedVsInferredSignals, planningReasonSummary } from '@/lib/revenue/explanations'

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function windowToDays(window: '7d' | '30d' | '90d' | 'all'): number {
  if (window === '7d') return 7
  if (window === '90d') return 90
  if (window === 'all') return 90
  return 30
}

type QueueRow = { status: string; action_type: string; created_at: string; error: string | null }

export function deriveFollowThroughLabel(args: {
  momentumLabel: 'rising' | 'steady' | 'cooling'
  freshness: 'unknown' | 'stale' | 'recent' | 'fresh'
  hasReadyPrepared: boolean
  hasQueuedOrProcessing: boolean
  hasFailedOrBlocked: boolean
  hasManualReview: boolean
}): { label: FollowThroughLabel; blockers: string[] } {
  const blockers: string[] = []

  if (args.hasFailedOrBlocked) {
    blockers.push('Delivery failed or is blocked.')
    return { label: 'blocked', blockers }
  }
  if (args.hasManualReview) {
    blockers.push('Waiting on manual review.')
    return { label: 'waiting_on_review', blockers }
  }
  if (args.hasQueuedOrProcessing) {
    return { label: 'ready_to_act', blockers }
  }
  if (args.hasReadyPrepared) {
    blockers.push('Prepared actions exist but have not been delivered.')
    return { label: 'needs_follow_through', blockers }
  }
  if (args.momentumLabel === 'cooling' || args.freshness === 'stale') {
    blockers.push('Signals are cooling or stale.')
    return { label: 'waiting_on_stronger_signal', blockers }
  }
  return { label: 'stale', blockers: blockers.length > 0 ? blockers : ['No recent follow-through signals observed.'] }
}

export async function buildFollowThroughSummary(args: {
  supabase: SupabaseClient
  workspaceId: string
  accountId: string
  window: '7d' | '30d' | '90d' | 'all'
  ex: AccountExplainability
}): Promise<FollowThroughSummary> {
  const computedAt = new Date().toISOString()
  const conf = deriveRevenueConfidence(args.ex)
  const since = isoDaysAgo(windowToDays(args.window))

  const { data: rows } = await args.supabase
    .schema('api')
    .from('action_queue_items')
    .select('status, action_type, created_at, error')
    .eq('workspace_id', args.workspaceId)
    .eq('lead_id', args.accountId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(100)

  const items = (rows ?? []) as unknown as QueueRow[]
  const hasReadyPrepared = items.some((r) => r.status === 'ready')
  const hasQueuedOrProcessing = items.some((r) => r.status === 'queued' || r.status === 'processing')
  const hasFailedOrBlocked = items.some((r) => r.status === 'failed' || r.status === 'blocked')
  const hasManualReview = items.some((r) => r.status === 'manual_review' || r.action_type === 'manual_review_required')

  const derived = deriveFollowThroughLabel({
    momentumLabel: args.ex.momentum.label,
    freshness: args.ex.dataQuality.freshness,
    hasReadyPrepared,
    hasQueuedOrProcessing,
    hasFailedOrBlocked,
    hasManualReview,
  })

  const limitations = conf.limitationsNote
    ? `${conf.limitationsNote} Follow-through states are derived from observed workflow activity.`
    : 'Follow-through states are derived from observed workflow activity.'

  return {
    type: 'readiness_for_action',
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    window: args.window,
    version: 'follow_v1',
    computedAt,
    confidence: conf.label,
    reasonSummary: planningReasonSummary(args.ex),
    signals: observedVsInferredSignals(args.ex),
    limitationsNote: limitations,
    followThrough: derived.label,
    blockers: derived.blockers,
  }
}

