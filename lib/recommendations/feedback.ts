import type { FeedbackKind, RecommendationConfidenceLabel } from '@/lib/recommendations/types'

export type FeedbackSummary = {
  windowDays: number
  counts: Record<FeedbackKind, number>
  lastSubmittedAt: string | null
}

export type FeedbackAdjustment = {
  priorityDelta: number
  confidenceFloor: RecommendationConfidenceLabel | null
  note: string | null
}

export function computeFeedbackAdjustment(summary: FeedbackSummary | null): FeedbackAdjustment {
  if (!summary) return { priorityDelta: 0, confidenceFloor: null, note: null }

  const useful = summary.counts.useful ?? 0
  const notUseful = summary.counts.not_useful ?? 0
  const wrongTiming = summary.counts.wrong_timing ?? 0
  const manualOverride = summary.counts.manual_override ?? 0

  // Bound and explainable: feedback nudges ranking, never replaces base signals.
  const raw = useful * 2 - notUseful * 3 - wrongTiming * 2 - manualOverride * 1
  const priorityDelta = Math.max(-10, Math.min(10, raw))

  const note =
    priorityDelta === 0
      ? null
      : priorityDelta > 0
        ? 'Team feedback has been positive for this recommendation class.'
        : 'Team feedback suggests caution for this recommendation class.'

  // If recent feedback is mostly negative, avoid “strong” confidence claims.
  const net = useful - notUseful - wrongTiming
  const confidenceFloor: RecommendationConfidenceLabel | null = net < -2 ? 'limited' : null

  return { priorityDelta, confidenceFloor, note }
}

