export type DataQualityLabel = 'limited' | 'usable' | 'strong'
export type FreshnessLabel = 'unknown' | 'stale' | 'recent' | 'fresh'

export type DataQualitySourceCoverage = {
  signalEventsCount: number
  uniqueSignalTypesCount: number
  hasFirstPartyMatch: boolean
  firstPartyVisitorCount14d: number
}

export type ExplainabilityCompleteness = {
  hasScoreReasons: boolean
  hasMomentum: boolean
  hasPeopleRecommendations: boolean
}

export type DataQualitySummary = {
  quality: DataQualityLabel
  freshness: FreshnessLabel
  /** Best-effort: most recent supporting timestamp, if any. */
  lastObservedAt: string | null
  coverage: DataQualitySourceCoverage
  completeness: ExplainabilityCompleteness
  limitations: string[]
  operatorNotes: string[]
}

export type ReportSourceQualitySummary = {
  quality: DataQualityLabel
  freshness: FreshnessLabel
  sourcesFetchedAt: string | null
  citationsCount: number
  internalSignalsCount: number | null
  limitations: string[]
}

