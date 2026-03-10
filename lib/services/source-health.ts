import type { SignalEvent } from '@/lib/domain/explainability'
import type { SourceHealthSummary, SourceFreshnessLabel } from '@/lib/domain/source-health'

function ageDays(iso: string): number | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  return Math.max(0, (Date.now() - ms) / (24 * 3600 * 1000))
}

function labelForAgeDays(days: number | null): SourceFreshnessLabel {
  if (days == null) return 'unknown'
  if (days <= 2) return 'fresh'
  if (days <= 7) return 'recent'
  return 'stale'
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a.localeCompare(b) >= 0 ? a : b
}

export function deriveSourceHealth(args: {
  window: SourceHealthSummary['window']
  signals: SignalEvent[]
  firstPartyLastVisitedAt: string | null
}): SourceHealthSummary {
  const lastSignalAt = args.signals.map((s) => s.detectedAt).sort((a, b) => b.localeCompare(a))[0] ?? null
  const lastFirstPartyAt = args.firstPartyLastVisitedAt
  const lastObservedAt = maxIso(lastSignalAt, lastFirstPartyAt)

  const freshnessDays = lastObservedAt ? ageDays(lastObservedAt) : null
  const freshness = labelForAgeDays(freshnessDays)

  const notes: string[] = []
  if (!lastObservedAt) {
    notes.push('No recent signals or first-party matches were observed for this account.')
  } else if (freshness === 'stale') {
    notes.push('The most recent supporting activity is older than a week.')
  } else if (freshness === 'fresh') {
    notes.push('Signals are fresh enough to act on quickly.')
  }

  if (!lastFirstPartyAt) {
    notes.push('No first-party visitor match is available for this account yet.')
  }

  return { window: args.window, lastSignalAt, lastFirstPartyAt, freshness, notes }
}

