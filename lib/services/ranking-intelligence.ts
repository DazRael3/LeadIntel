import type { SupabaseClient } from '@supabase/supabase-js'
import type { LearningContext } from '@/lib/recommendations/engine'
import type { FeedbackKind, OutcomeKind } from '@/lib/recommendations/types'

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

type FeedbackAggRow = { kind: string; c: number; max_created_at: string | null }
type OutcomeAggRow = { outcome: string; c: number; max_recorded_at: string | null }

export async function getLearningContextForWorkspace(args: {
  supabase: SupabaseClient
  workspaceId: string
  windowDays: number
  recommendationType: 'account_priority'
}): Promise<LearningContext> {
  const since = isoDaysAgo(Math.max(1, Math.min(90, Math.floor(args.windowDays))))

  const [fbRes, outRes] = await Promise.all([
    args.supabase
      .schema('api')
      .from('recommendation_feedback')
      .select('kind, created_at')
      .eq('workspace_id', args.workspaceId)
      .eq('recommendation_type', args.recommendationType)
      .gte('created_at', since),
    args.supabase
      .schema('api')
      .from('outcome_records')
      .select('outcome, recorded_at')
      .eq('workspace_id', args.workspaceId)
      .gte('recorded_at', since),
  ])

  const fbCounts: Record<FeedbackKind, number> = {
    useful: 0,
    not_useful: 0,
    wrong_persona: 0,
    wrong_timing: 0,
    wrong_angle: 0,
    good_opener: 0,
    weak_opener: 0,
    manual_override: 0,
  }
  let lastFb: string | null = null
  for (const r of (fbRes.data ?? []) as unknown as Array<{ kind?: unknown; created_at?: unknown }>) {
    const k = r.kind
    if (typeof k === 'string' && k in fbCounts) fbCounts[k as FeedbackKind] += 1
    const ts = typeof r.created_at === 'string' ? r.created_at : null
    if (ts && (!lastFb || Date.parse(ts) > Date.parse(lastFb))) lastFb = ts
  }

  const outCounts: Record<OutcomeKind, number> = {
    no_outcome_yet: 0,
    replied: 0,
    meeting_booked: 0,
    qualified: 0,
    opportunity_created: 0,
    not_a_fit: 0,
    wrong_timing: 0,
    no_response: 0,
    manual_dismissal: 0,
  }
  let lastOut: string | null = null
  for (const r of (outRes.data ?? []) as unknown as Array<{ outcome?: unknown; recorded_at?: unknown }>) {
    const k = r.outcome
    if (typeof k === 'string' && k in outCounts) outCounts[k as OutcomeKind] += 1
    const ts = typeof r.recorded_at === 'string' ? r.recorded_at : null
    if (ts && (!lastOut || Date.parse(ts) > Date.parse(lastOut))) lastOut = ts
  }

  return {
    feedback: { windowDays: args.windowDays, counts: fbCounts, lastSubmittedAt: lastFb },
    outcomes: { windowDays: args.windowDays, counts: outCounts, lastRecordedAt: lastOut },
  }
}

