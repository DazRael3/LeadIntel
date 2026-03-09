import type { RevenueConfidenceLabel } from '@/lib/revenue/types'
import type { AccountExplainability } from '@/lib/data/getAccountExplainability'

export function deriveRevenueConfidence(ex: AccountExplainability): { label: RevenueConfidenceLabel; limitationsNote: string | null } {
  const limitations: string[] = []
  if (ex.dataQuality.quality === 'limited') limitations.push('Source coverage is limited.')
  if (ex.dataQuality.freshness === 'stale') limitations.push('Signals are stale.')
  if (ex.firstPartyIntent.summary.label === 'none') limitations.push('No first-party intent match yet.')
  if (!ex.dataQuality.completeness.hasPeopleRecommendations) limitations.push('Stakeholder recommendations are thin.')

  const label: RevenueConfidenceLabel =
    ex.dataQuality.quality === 'strong' && (ex.dataQuality.freshness === 'fresh' || ex.dataQuality.freshness === 'recent')
      ? 'strong'
      : ex.dataQuality.quality === 'usable' || ex.dataQuality.freshness === 'recent'
        ? 'usable'
        : 'limited'

  return { label, limitationsNote: limitations.length > 0 ? limitations.join(' ') : null }
}

