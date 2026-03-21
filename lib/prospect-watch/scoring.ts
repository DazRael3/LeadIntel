import type { ProspectSignalType } from './classify'

export type ScoreBreakdown = {
  icpFit: number
  signalStrength: number
  urgency: number
  confidence: number
  overall: number
  reasons: string[]
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function urgencyScoreFromOccurredAt(args: { occurredAt: Date | null; now: Date }): { score: number; reason: string } {
  if (!args.occurredAt || !Number.isFinite(args.occurredAt.getTime())) {
    return { score: 40, reason: 'Freshness unknown (default)' }
  }
  const hours = (args.now.getTime() - args.occurredAt.getTime()) / (1000 * 60 * 60)
  if (hours <= 24) return { score: 95, reason: 'Very recent signal (<24h)' }
  if (hours <= 72) return { score: 80, reason: 'Recent signal (<3d)' }
  if (hours <= 168) return { score: 60, reason: 'Signal within last week' }
  if (hours <= 336) return { score: 45, reason: 'Signal within last 2 weeks' }
  return { score: 30, reason: 'Older signal' }
}

export function signalStrengthFromType(type: ProspectSignalType): { score: number; reason: string } {
  switch (type) {
    case 'funding':
      return { score: 92, reason: 'Funding often correlates with new spend and GTM motion' }
    case 'hiring':
      return { score: 78, reason: 'Hiring indicates growth / new initiatives' }
    case 'product_launch':
      return { score: 76, reason: 'Launch creates urgency around execution and pipeline' }
    case 'partnership':
      return { score: 72, reason: 'Partnership signals new priorities and enablement needs' }
    case 'expansion':
      return { score: 70, reason: 'Expansion suggests new segments and outbound focus' }
    case 'leadership_hire':
      return { score: 68, reason: 'Leadership change can trigger workflow/tooling shifts' }
    case 'stack_change':
      return { score: 62, reason: 'Stack changes can create displacement windows' }
    default:
      return { score: 55, reason: 'General public update' }
  }
}

export function scoreProspect(args: {
  icpFitManual: number
  signalType: ProspectSignalType
  confidence: number
  occurredAt: Date | null
  now: Date
}): ScoreBreakdown {
  const icpFit = clampInt(args.icpFitManual, 0, 100)
  const strength = signalStrengthFromType(args.signalType)
  const urgency = urgencyScoreFromOccurredAt({ occurredAt: args.occurredAt, now: args.now })
  const confidence = clampInt(args.confidence, 0, 100)

  // Simple, explainable weighting.
  const overallRaw = icpFit * 0.4 + strength.score * 0.3 + urgency.score * 0.2 + confidence * 0.1
  const overall = clampInt(overallRaw, 0, 100)

  const reasons = [
    `ICP fit: ${icpFit}/100`,
    `Signal: ${strength.reason}`,
    `Urgency: ${urgency.reason}`,
    `Confidence: ${confidence}/100`,
  ]

  return {
    icpFit,
    signalStrength: strength.score,
    urgency: urgency.score,
    confidence,
    overall,
    reasons,
  }
}

