import type { AccountExplainability } from '@/lib/data/getAccountExplainability'

export type RevenueFeatureSnapshot = {
  score: number
  momentumLabel: string
  momentumDelta: number
  hasFirstParty: boolean
  visitorCount14d: number
  dataQuality: string
  freshness: string
  lastObservedAt: string | null
}

export function buildRevenueFeatureSnapshot(ex: AccountExplainability): RevenueFeatureSnapshot {
  return {
    score: Math.round(ex.scoreExplainability.score),
    momentumLabel: ex.momentum.label,
    momentumDelta: Math.round(ex.momentum.delta),
    hasFirstParty: ex.firstPartyIntent.summary.label !== 'none',
    visitorCount14d: ex.firstPartyIntent.visitorMatches.count,
    dataQuality: ex.dataQuality.quality,
    freshness: ex.dataQuality.freshness,
    lastObservedAt: ex.dataQuality.lastObservedAt,
  }
}

