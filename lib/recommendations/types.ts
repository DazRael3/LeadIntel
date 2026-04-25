import { z } from 'zod'
import type { DataQualitySummary } from '@/lib/domain/data-quality'
import type { SourceHealthSummary } from '@/lib/domain/source-health'
import type { SignalMomentum, ScoreExplainability, FirstPartyIntent } from '@/lib/domain/explainability'
import type { PersonaRecommendationSummary } from '@/lib/domain/people'

export type RecommendationConfidenceLabel = 'limited' | 'usable' | 'strong'

export type RecommendationType =
  | 'account_priority'
  | 'persona'
  | 'outreach_angle'
  | 'playbook'
  | 'next_best_action'
  | 'manual_review'

export type RecommendationTargetType = 'account' | 'workspace'

export type Recommendation = {
  id: string
  type: RecommendationType
  targetType: RecommendationTargetType
  targetId: string
  label: string
  reasonSummary: string
  supportingFactors: Array<{ label: string; value: string; tone: 'positive' | 'caution' | 'neutral' }>
  confidence: RecommendationConfidenceLabel
  limitationsNote: string | null
  version: string
  window: '7d' | '30d' | '90d' | 'all'
  computedAt: string
}

export type RecommendationBundle = {
  targetType: RecommendationTargetType
  targetId: string
  recommendations: Recommendation[]
  summary: {
    confidence: RecommendationConfidenceLabel
    whyNow: string
    limitationsNote: string | null
  }
  rank: {
    priorityScore: number
    band: 'high' | 'medium' | 'low'
    stability: 'stable' | 'tentative'
    delta: { direction: 'up' | 'down' | 'flat'; magnitude: 'small' | 'medium' | 'large'; note: string } | null
  }
}

export type RecommendationInputs = {
  window: '7d' | '30d' | '90d' | 'all'
  scoreExplainability: ScoreExplainability
  momentum: SignalMomentum
  firstPartyIntent: FirstPartyIntent
  dataQuality: DataQualitySummary
  sourceHealth: SourceHealthSummary
  people: PersonaRecommendationSummary
  account: { id: string; name: string | null; domain: string | null }
}

export const FeedbackKindSchema = z.enum([
  'useful',
  'not_useful',
  'wrong_persona',
  'wrong_timing',
  'wrong_angle',
  'good_opener',
  'weak_opener',
  'manual_override',
])
export type FeedbackKind = z.infer<typeof FeedbackKindSchema>

export const OutcomeKindSchema = z.enum([
  'no_outcome_yet',
  'replied',
  'meeting_booked',
  'qualified',
  'opportunity_created',
  'not_a_fit',
  'wrong_timing',
  'no_response',
  'manual_dismissal',
  'converted_yes',
  'converted_no',
])
export type OutcomeKind = z.infer<typeof OutcomeKindSchema>

