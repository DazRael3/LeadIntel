import type { RecommendationConfidenceLabel, RecommendationInputs } from '@/lib/recommendations/types'

export function deriveRecommendationConfidence(inputs: RecommendationInputs): {
  label: RecommendationConfidenceLabel
  limitationsNote: string | null
} {
  const limitations: string[] = []

  if (inputs.dataQuality.quality === 'limited') limitations.push('Source coverage is limited for this account.')
  if (inputs.dataQuality.freshness === 'stale') limitations.push('Signals are stale; timing may be weaker than usual.')
  if (inputs.firstPartyIntent.summary.label === 'none') limitations.push('No first-party intent match yet.')
  if (!inputs.dataQuality.completeness.hasScoreReasons) limitations.push('Score reasons are thin.')

  // Confidence label is intentionally coarse and explainable.
  if (inputs.dataQuality.quality === 'strong' && inputs.dataQuality.freshness === 'fresh') {
    return { label: 'strong', limitationsNote: limitations.length > 0 ? limitations.join(' ') : null }
  }
  if (inputs.dataQuality.quality === 'usable' || inputs.dataQuality.freshness === 'recent') {
    return { label: 'usable', limitationsNote: limitations.length > 0 ? limitations.join(' ') : null }
  }
  return { label: 'limited', limitationsNote: limitations.length > 0 ? limitations.join(' ') : 'Recommendations are heuristic when data is thin.' }
}

