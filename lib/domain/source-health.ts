export type SourceFreshnessLabel = 'unknown' | 'stale' | 'recent' | 'fresh'

export type SourceHealthSummary = {
  window: '7d' | '30d' | '90d' | 'all'
  lastSignalAt: string | null
  lastFirstPartyAt: string | null
  freshness: SourceFreshnessLabel
  notes: string[]
}

