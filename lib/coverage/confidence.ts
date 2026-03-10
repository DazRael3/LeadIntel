import type { CoverageConfidenceLabel } from '@/lib/coverage/types'
import type { AccountExplainability } from '@/lib/data/getAccountExplainability'

export function deriveCoverageConfidence(ex: AccountExplainability): { label: CoverageConfidenceLabel; limitationsNote: string | null } {
  const notes: string[] = []
  if (ex.dataQuality.quality === 'limited') notes.push('Source coverage is limited.')
  if (ex.dataQuality.freshness === 'stale') notes.push('Signals are stale.')
  if (ex.firstPartyIntent.summary.label === 'none') notes.push('No first-party match yet.')

  const label: CoverageConfidenceLabel =
    ex.dataQuality.quality === 'strong' && (ex.dataQuality.freshness === 'fresh' || ex.dataQuality.freshness === 'recent')
      ? 'strong'
      : ex.dataQuality.quality === 'usable' || ex.dataQuality.freshness === 'recent'
        ? 'usable'
        : 'limited'

  return { label, limitationsNote: notes.length > 0 ? notes.join(' ') : null }
}

