import crypto from 'crypto'
import type { Recommendation, RecommendationBundle, RecommendationInputs, RecommendationType } from '@/lib/recommendations/types'
import { deriveRecommendationConfidence } from '@/lib/recommendations/confidence'
import { buildFeatureSnapshot, stableFeatureKey } from '@/lib/recommendations/features'
import { supportingFactors, whyNowSummary } from '@/lib/recommendations/explanations'
import type { FeedbackSummary } from '@/lib/recommendations/feedback'
import { computeFeedbackAdjustment } from '@/lib/recommendations/feedback'
import type { OutcomeSummary } from '@/lib/recommendations/outcomes'
import { computeOutcomeAdjustment } from '@/lib/recommendations/outcomes'
import { USE_CASE_PLAYBOOKS } from '@/lib/use-cases/playbooks'

export const RECOMMENDATION_ENGINE_VERSION = 'rec_v1'

export type LearningContext = {
  feedback: FeedbackSummary | null
  outcomes: OutcomeSummary | null
}

function recId(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24)
}

function priorityBand(score: number): { band: 'high' | 'medium' | 'low'; stability: 'stable' | 'tentative' } {
  if (score >= 70) return { band: 'high', stability: 'stable' }
  if (score >= 45) return { band: 'medium', stability: 'stable' }
  return { band: 'low', stability: 'tentative' }
}

function computePriorityScore(args: { inputs: RecommendationInputs; learning: LearningContext | null }): { score: number; why: string[]; note: string | null } {
  const { inputs } = args
  const why: string[] = []

  // Base: existing explainable score.
  let score = Math.max(0, Math.min(100, Math.round(inputs.scoreExplainability.score)))
  why.push('Base score')

  // Momentum.
  if (inputs.momentum.label === 'rising') {
    score += 10
    why.push('Rising momentum')
  } else if (inputs.momentum.label === 'cooling') {
    score -= 6
    why.push('Cooling momentum')
  }

  // First-party intent.
  if (inputs.firstPartyIntent.summary.label !== 'none') {
    score += 8
    why.push('First-party intent match')
  } else {
    score -= 4
    why.push('No first-party match')
  }

  // Data quality.
  if (inputs.dataQuality.quality === 'strong') {
    score += 5
    why.push('Strong coverage')
  } else if (inputs.dataQuality.quality === 'limited') {
    score -= 8
    why.push('Limited coverage')
  }

  if (inputs.dataQuality.freshness === 'stale') {
    score -= 6
    why.push('Stale freshness')
  } else if (inputs.dataQuality.freshness === 'fresh') {
    score += 3
    why.push('Fresh signals')
  }

  let note: string | null = null
  if (args.learning) {
    const fb = computeFeedbackAdjustment(args.learning.feedback)
    const oc = computeOutcomeAdjustment(args.learning.outcomes)
    const delta = fb.priorityDelta + oc.priorityDelta
    if (delta !== 0) {
      score += delta
      note = [fb.note, oc.note].filter(Boolean).join(' ')
      why.push('Workspace feedback/outcomes (bounded)')
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  return { score, why, note: note || null }
}

function mapPlaybookFromSignals(inputs: RecommendationInputs): { slug: string; title: string } | null {
  const top = inputs.momentum.topSignalTypes?.[0]?.type ?? null
  if (!top) return null
  const t = top.trim().toLowerCase()
  const slug =
    t.includes('fund') ? 'funding-outreach'
    : t.includes('hire') || t.includes('leadership') ? 'hiring-spike'
    : t.includes('product_launch') || t.includes('launch') ? 'product-launch-timing'
    : t.includes('partnership') ? 'partnership-announcement'
    : t.includes('expansion') ? 'expansion-signals'
    : null
  if (!slug) return null
  const pb = USE_CASE_PLAYBOOKS.find((p) => p.slug === slug)
  return pb ? { slug: pb.slug, title: pb.title } : { slug, title: slug }
}

function makeRec(args: {
  type: RecommendationType
  inputs: RecommendationInputs
  label: string
  reasonSummary: string
  confidence: 'limited' | 'usable' | 'strong'
  limitationsNote: string | null
  factors: Recommendation['supportingFactors']
}): Recommendation {
  const computedAt = new Date().toISOString()
  return {
    id: recId([RECOMMENDATION_ENGINE_VERSION, args.type, args.inputs.account.id, computedAt.slice(0, 10)].join('|')),
    type: args.type,
    targetType: 'account',
    targetId: args.inputs.account.id,
    label: args.label,
    reasonSummary: args.reasonSummary,
    supportingFactors: args.factors,
    confidence: args.confidence,
    limitationsNote: args.limitationsNote,
    version: RECOMMENDATION_ENGINE_VERSION,
    window: args.inputs.window,
    computedAt,
  }
}

export function buildAccountRecommendationBundle(args: {
  inputs: RecommendationInputs
  learning: LearningContext | null
  previousSnapshot: { priorityScore: number; featureKey: string; computedAt: string } | null
}): { bundle: RecommendationBundle; snapshot: { priorityScore: number; featureKey: string; computedAt: string } } {
  const conf = deriveRecommendationConfidence(args.inputs)
  const factors = supportingFactors(args.inputs)

  const feature = buildFeatureSnapshot(args.inputs)
  const featureKey = stableFeatureKey(feature)

  const priority = computePriorityScore({ inputs: args.inputs, learning: args.learning })
  const band = priorityBand(priority.score)

  const delta = (() => {
    const prev = args.previousSnapshot
    if (!prev) return null
    const diff = priority.score - prev.priorityScore
    if (diff === 0 && prev.featureKey === featureKey) return null
    const dir: 'up' | 'down' | 'flat' = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
    const abs = Math.abs(diff)
    const magnitude: 'small' | 'medium' | 'large' = abs >= 15 ? 'large' : abs >= 7 ? 'medium' : 'small'
    const note =
      prev.featureKey !== featureKey
        ? 'Signals or context changed since the last view.'
        : diff > 0
          ? 'This account moved up in recommendation priority.'
          : diff < 0
            ? 'This account moved down in recommendation priority.'
            : 'Recommendation priority is similar.'
    return { direction: dir, magnitude, note }
  })()

  const whyNow = whyNowSummary(args.inputs)

  const playbook = mapPlaybookFromSignals(args.inputs)
  const persona = args.inputs.people.topPersonas?.[0] ?? null

  const recs: Recommendation[] = []

  recs.push(
    makeRec({
      type: 'account_priority',
      inputs: args.inputs,
      label: priority.score >= 70 ? 'Act now' : priority.score >= 45 ? 'Review' : 'Monitor',
      reasonSummary: whyNow,
      confidence: conf.label,
      limitationsNote: conf.limitationsNote,
      factors,
    })
  )

  recs.push(
    makeRec({
      type: 'persona',
      inputs: args.inputs,
      label: persona ? `Start with ${persona}` : 'Start with a broad owner',
      reasonSummary: persona ? `Persona recommendation is based on observed signal families and your context.` : 'Persona suggestion is heuristic due to limited evidence.',
      confidence: args.inputs.people.confidence,
      limitationsNote: args.inputs.people.confidence === 'limited' ? 'Persona fit evidence is limited; verify the owner quickly.' : null,
      factors,
    })
  )

  if (playbook) {
    recs.push(
      makeRec({
        type: 'playbook',
        inputs: args.inputs,
        label: playbook.title,
        reasonSummary: `Recommended based on the top signal family and current momentum.`,
        confidence: conf.label,
        limitationsNote: conf.limitationsNote,
        factors,
      })
    )
  }

  // Manual review recommendation when confidence is limited or signals are stale/cooling.
  if (conf.label === 'limited' || args.inputs.dataQuality.freshness === 'stale' || args.inputs.momentum.label === 'cooling') {
    recs.push(
      makeRec({
        type: 'manual_review',
        inputs: args.inputs,
        label: 'Manual review',
        reasonSummary: 'Recommendation confidence is limited; verify context before acting.',
        confidence: 'limited',
        limitationsNote: conf.limitationsNote,
        factors,
      })
    )
  }

  // Next-best-action is returned as a recommendation shell; execution guidance is in next-best-action service.
  recs.push(
    makeRec({
      type: 'next_best_action',
      inputs: args.inputs,
      label: priority.score >= 70 ? 'Prepare a handoff package' : priority.score >= 45 ? 'Generate a first touch' : 'Wait for a stronger signal',
      reasonSummary: 'Suggested next step based on timing, momentum, and current coverage.',
      confidence: conf.label,
      limitationsNote: conf.limitationsNote,
      factors,
    })
  )

  const summaryConfidence = conf.label
  const summaryLimitations = conf.limitationsNote

  const snapshot = { priorityScore: priority.score, featureKey, computedAt: new Date().toISOString() }

  return {
    bundle: {
      targetType: 'account',
      targetId: args.inputs.account.id,
      recommendations: recs,
      summary: {
        confidence: summaryConfidence,
        whyNow,
        limitationsNote: summaryLimitations,
      },
      rank: {
        priorityScore: priority.score,
        band: band.band,
        stability: band.stability,
        delta,
      },
    },
    snapshot,
  }
}

