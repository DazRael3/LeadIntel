import type { PipelineInfluenceLabel } from '@/lib/revenue/types'
import type { OutcomeKind } from '@/lib/recommendations/types'

export type InfluenceInputs = {
  hasFirstParty: boolean
  momentumLabel: 'rising' | 'steady' | 'cooling'
  deliveredActionsCount: number
  preparedActionsCount: number
  outcomes: OutcomeKind[]
  dataQuality: 'limited' | 'usable' | 'strong'
  freshness: 'unknown' | 'stale' | 'recent' | 'fresh'
}

export function derivePipelineInfluenceLabel(i: InfluenceInputs): { label: PipelineInfluenceLabel; why: string[]; missing: string[] } {
  const why: string[] = []
  const missing: string[] = []

  const confirmed = i.outcomes.some((o) => o === 'meeting_booked' || o === 'qualified' || o === 'opportunity_created')
  if (confirmed) {
    why.push('Confirmed progression outcome recorded.')
    return { label: 'confirmed_progression', why, missing }
  }

  const hasActivity = i.hasFirstParty || i.momentumLabel === 'rising'
  if (!hasActivity) missing.push('No strong timing signals or intent yet.')

  if (i.deliveredActionsCount > 0) {
    why.push('Operational handoff delivered.')
    if (hasActivity) return { label: 'high_attention', why, missing: missing.filter((m) => !m.includes('timing')) }
    return { label: 'building', why, missing }
  }

  if (i.preparedActionsCount > 0) {
    why.push('Handoff prepared but not delivered yet.')
    if (i.momentumLabel === 'rising' || i.hasFirstParty) return { label: 'building', why, missing: ['Delivery not completed yet.'] }
    return { label: 'early_influence', why, missing: ['Delivery not completed yet.'] }
  }

  if (i.hasFirstParty || i.momentumLabel === 'rising') {
    why.push('Timing signals indicate potential relevance.')
    if (i.dataQuality === 'limited' || i.freshness === 'stale') {
      missing.push('Evidence quality is limited; verify context.')
      return { label: 'early_influence', why, missing }
    }
    return { label: 'building', why, missing }
  }

  return { label: 'unknown', why: ['Insufficient observed evidence for influence.'], missing: ['More signals or explicit outcomes are needed.'] }
}

