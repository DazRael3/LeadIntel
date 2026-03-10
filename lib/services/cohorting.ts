import type { AccountExplainability } from '@/lib/data/getAccountExplainability'

export type PatternBucketKey =
  | 'mom_rising_intent_active_quality_strong'
  | 'mom_rising_intent_active_quality_usable'
  | 'mom_rising_intent_active_quality_limited'
  | 'mom_rising_intent_none_quality_strong'
  | 'mom_rising_intent_none_quality_usable'
  | 'mom_rising_intent_none_quality_limited'
  | 'mom_steady_intent_active_quality_strong'
  | 'mom_steady_intent_active_quality_usable'
  | 'mom_steady_intent_active_quality_limited'
  | 'mom_steady_intent_none_quality_strong'
  | 'mom_steady_intent_none_quality_usable'
  | 'mom_steady_intent_none_quality_limited'
  | 'mom_cooling_intent_active_quality_strong'
  | 'mom_cooling_intent_active_quality_usable'
  | 'mom_cooling_intent_active_quality_limited'
  | 'mom_cooling_intent_none_quality_strong'
  | 'mom_cooling_intent_none_quality_usable'
  | 'mom_cooling_intent_none_quality_limited'

function intentBucket(label: AccountExplainability['firstPartyIntent']['summary']['label']): 'active' | 'none' {
  return label === 'none' ? 'none' : 'active'
}

export function derivePatternBucket(explainability: AccountExplainability): PatternBucketKey {
  const m = explainability.momentum.label
  const i = intentBucket(explainability.firstPartyIntent.summary.label)
  const q = explainability.dataQuality.quality
  return `mom_${m}_intent_${i}_quality_${q}` as PatternBucketKey
}

