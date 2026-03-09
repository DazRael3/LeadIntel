import type { OutcomeKind } from '@/lib/recommendations/types'

export type OutcomeSummary = {
  windowDays: number
  counts: Record<OutcomeKind, number>
  lastRecordedAt: string | null
}

export type OutcomeAdjustment = {
  priorityDelta: number
  note: string | null
}

export function computeOutcomeAdjustment(summary: OutcomeSummary | null): OutcomeAdjustment {
  if (!summary) return { priorityDelta: 0, note: null }

  const meeting = summary.counts.meeting_booked ?? 0
  const replied = summary.counts.replied ?? 0
  const opp = summary.counts.opportunity_created ?? 0
  const noResponse = summary.counts.no_response ?? 0
  const notFit = summary.counts.not_a_fit ?? 0

  // Bounded heuristic: outcomes nudge priority, no causation claims.
  const raw = meeting * 3 + replied * 1 + opp * 4 - noResponse * 1 - notFit * 2
  const priorityDelta = Math.max(-10, Math.min(10, raw))

  const note =
    priorityDelta === 0
      ? null
      : priorityDelta > 0
        ? 'Observed outcomes in this workspace support acting on similar accounts.'
        : 'Observed outcomes suggest caution for similar accounts.'

  return { priorityDelta, note }
}

