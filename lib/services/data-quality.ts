import type { DataQualityLabel, DataQualitySummary, FreshnessLabel, ReportSourceQualitySummary } from '@/lib/domain/data-quality'
import type { FirstPartyIntent, SignalEvent, SignalMomentum, ScoreExplainability } from '@/lib/domain/explainability'
import type { BuyingGroupRecommendation, PersonaRecommendationSummary } from '@/lib/domain/people'

function ageDays(iso: string): number | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  return Math.max(0, (Date.now() - ms) / (24 * 3600 * 1000))
}

function freshnessFromDays(days: number | null): FreshnessLabel {
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

function qualityFromCoverage(args: {
  signalEventsCount: number
  uniqueSignalTypesCount: number
  freshness: FreshnessLabel
  hasScoreReasons: boolean
}): DataQualityLabel {
  const hasSignals = args.signalEventsCount > 0
  if (!hasSignals && !args.hasScoreReasons) return 'limited'

  // Strong: enough signals, some diversity, and not stale.
  if (args.signalEventsCount >= 6 && args.uniqueSignalTypesCount >= 2 && (args.freshness === 'fresh' || args.freshness === 'recent')) {
    return 'strong'
  }
  // Usable: a small cluster of signals or clear reasons, even if depth is limited.
  if (args.signalEventsCount >= 2 || args.hasScoreReasons) return 'usable'
  return 'limited'
}

export function deriveAccountDataQuality(args: {
  signals: SignalEvent[]
  scoreExplainability: ScoreExplainability
  momentum: SignalMomentum | null
  firstPartyIntent: FirstPartyIntent
  people: { personas: PersonaRecommendationSummary; buyingGroup: BuyingGroupRecommendation } | null
}): DataQualitySummary {
  const signalEventsCount = args.signals.length
  const uniqueSignalTypesCount = new Set(args.signals.map((s) => s.type.trim()).filter(Boolean)).size
  const firstPartyVisitorCount14d = args.firstPartyIntent.visitorMatches.count
  const hasFirstPartyMatch = firstPartyVisitorCount14d > 0

  const lastSignalAt = args.momentum?.mostRecentSignalAt ?? null
  const lastFirstPartyAt = args.firstPartyIntent.visitorMatches.lastVisitedAt
  const lastObservedAt = maxIso(lastSignalAt, lastFirstPartyAt)
  const freshness = freshnessFromDays(lastObservedAt ? ageDays(lastObservedAt) : null)

  const hasScoreReasons = (args.scoreExplainability?.reasons ?? []).length > 0
  const hasMomentum = Boolean(args.momentum)
  const hasPeopleRecommendations = Boolean(args.people?.personas)

  const limitations: string[] = []
  const operatorNotes: string[] = []

  if (signalEventsCount === 0) limitations.push('No recent signal events were found for the selected window.')
  if (freshness === 'stale') limitations.push('Signals are stale. Timing-based outputs may be lighter than usual.')
  if (!hasFirstPartyMatch) limitations.push('No first-party visitor match is available yet for this domain.')
  if (!hasScoreReasons) limitations.push('Score explainability is limited (few reasons available).')

  if (signalEventsCount < 2) operatorNotes.push('If this account should have coverage, verify signal ingestion for this domain.')
  if (!hasFirstPartyMatch) operatorNotes.push('If first-party intent is expected, confirm tracking/visitor ingestion and domain matching.')
  if (freshness === 'stale') operatorNotes.push('Consider refreshing sources or waiting for new signals before prioritizing.')

  const quality = qualityFromCoverage({ signalEventsCount, uniqueSignalTypesCount, freshness, hasScoreReasons })

  return {
    quality,
    freshness,
    lastObservedAt,
    coverage: { signalEventsCount, uniqueSignalTypesCount, hasFirstPartyMatch, firstPartyVisitorCount14d },
    completeness: { hasScoreReasons, hasMomentum, hasPeopleRecommendations },
    limitations,
    operatorNotes,
  }
}

function safeNumber(v: unknown): number | null {
  if (typeof v !== 'number') return null
  if (!Number.isFinite(v)) return null
  return v
}

export function deriveReportSourceQuality(args: {
  citationsCount: number
  sourcesFetchedAt: string | null
  meta: unknown
}): ReportSourceQualitySummary {
  const freshness = freshnessFromDays(args.sourcesFetchedAt ? ageDays(args.sourcesFetchedAt) : null)
  const internalSignalsCount =
    args.meta && typeof args.meta === 'object'
      ? safeNumber((args.meta as Record<string, unknown>).internalSignalsCount)
      : null

  const limitations: string[] = []
  if (args.citationsCount < 2) limitations.push('Source coverage is thin (few citations available).')
  if (freshness === 'stale') limitations.push('Sources may be stale; consider refreshing and regenerating.')

  const quality: DataQualityLabel =
    args.citationsCount >= 6 && (freshness === 'fresh' || freshness === 'recent')
      ? 'strong'
      : args.citationsCount >= 2
        ? 'usable'
        : 'limited'

  return {
    quality,
    freshness,
    sourcesFetchedAt: args.sourcesFetchedAt,
    citationsCount: args.citationsCount,
    internalSignalsCount,
    limitations,
  }
}

