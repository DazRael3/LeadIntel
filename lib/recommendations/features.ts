import type { RecommendationInputs } from '@/lib/recommendations/types'

export type RecommendationFeatureSnapshot = {
  baseScore: number
  momentumLabel: string
  momentumDelta: number
  firstPartyLabel: string
  firstPartyVisitorCount14d: number
  dataQuality: string
  freshness: string
  lastObservedAt: string | null
  topSignalType: string | null
}

export function buildFeatureSnapshot(inputs: RecommendationInputs): RecommendationFeatureSnapshot {
  const topSignalType = inputs.momentum.topSignalTypes?.[0]?.type ?? null
  return {
    baseScore: Math.round(inputs.scoreExplainability.score),
    momentumLabel: inputs.momentum.label,
    momentumDelta: Math.round(inputs.momentum.delta),
    firstPartyLabel: inputs.firstPartyIntent.summary.label,
    firstPartyVisitorCount14d: inputs.firstPartyIntent.visitorMatches.count,
    dataQuality: inputs.dataQuality.quality,
    freshness: inputs.dataQuality.freshness,
    lastObservedAt: inputs.dataQuality.lastObservedAt,
    topSignalType,
  }
}

export function stableFeatureKey(s: RecommendationFeatureSnapshot): string {
  // This is not a model weight dump—just a stable “what changed” fingerprint.
  return [
    `score:${s.baseScore}`,
    `mom:${s.momentumLabel}:${s.momentumDelta}`,
    `fp:${s.firstPartyLabel}:${s.firstPartyVisitorCount14d}`,
    `dq:${s.dataQuality}:${s.freshness}`,
    `top:${s.topSignalType ?? 'none'}`,
  ].join('|')
}

