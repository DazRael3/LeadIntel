import type { ScoredTriggerEvent } from '@/lib/services/trigger-events/engine'

export interface LeadRowLike {
  id: string
  company_name?: string | null
  company_domain?: string | null
  company_url?: string | null
  industry?: string | null
}

export interface LeadScoringContext {
  lead: LeadRowLike
  events: ScoredTriggerEvent[]
  userSignals: {
    isWatchlisted: boolean
    unlockedCount: number
    pitchesGenerated: number
    emailsSent: number
    lastInteractionAt: Date | null
  }
  userSettings?: {
    whatYouSell?: string
    idealCustomer?: string
  }
}

export interface LeadScoreResult {
  score: number // 0-100
  reasons: string[]
}

export interface LeadScoreBreakdownItem {
  label: string
  points: number
}

export interface LeadScoreDetailedResult extends LeadScoreResult {
  breakdown: LeadScoreBreakdownItem[]
  reasonCodes: string[]
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function normalizeText(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : ''
}

function scoreIcpFit(ctx: LeadScoringContext): { points: number; reasons: string[] } {
  const reasons: string[] = []
  const idealCustomer = normalizeText(ctx.userSettings?.idealCustomer)
  const whatYouSell = normalizeText(ctx.userSettings?.whatYouSell)
  const industry = normalizeText(ctx.lead.industry)

  // Conservative: don't assume fit; just light boosts when we have signals.
  let points = 0
  if (idealCustomer) {
    points += 6
    reasons.push('icp_defined')
  }
  if (whatYouSell) {
    points += 4
    reasons.push('solution_defined')
  }
  if (idealCustomer && industry && (idealCustomer.includes(industry) || industry.includes(idealCustomer))) {
    points += 10
    reasons.push('industry_matches_icp')
  }
  return { points, reasons }
}

function scoreEngagement(ctx: LeadScoringContext): { points: number; reasons: string[] } {
  const reasons: string[] = []
  let points = 0

  if (ctx.userSignals.isWatchlisted) {
    points += 6
    reasons.push('watchlisted')
  }
  if (ctx.userSignals.unlockedCount > 0) {
    points += Math.min(10, 4 + ctx.userSignals.unlockedCount)
    reasons.push('unlocked')
  }
  if (ctx.userSignals.pitchesGenerated > 0) {
    points += Math.min(12, 6 + 2 * ctx.userSignals.pitchesGenerated)
    reasons.push('pitches_generated')
  }
  if (ctx.userSignals.emailsSent > 0) {
    points += Math.min(12, 6 + 2 * ctx.userSignals.emailsSent)
    reasons.push('emails_sent')
  }
  if (ctx.userSignals.lastInteractionAt) {
    const days = (Date.now() - ctx.userSignals.lastInteractionAt.getTime()) / (24 * 60 * 60 * 1000)
    if (days <= 1) {
      points += 8
      reasons.push('recent_interaction_24h')
    } else if (days <= 7) {
      points += 4
      reasons.push('recent_interaction_7d')
    }
  }

  return { points, reasons }
}

function scoreEvents(events: ScoredTriggerEvent[]): { points: number; reasons: string[] } {
  const reasons: string[] = []
  let points = 0

  const top = events.slice(0, 5)
  const byCategory: Record<string, number> = {}
  for (const e of top) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1
  }

  // Category boosts (heuristic). Keep bounded to avoid runaway.
  if (byCategory.funding) {
    points += 18
    reasons.push('recent_funding')
  }
  if (byCategory.leadership_change) {
    points += 12
    reasons.push('leadership_change')
  }
  if (byCategory.product_launch) {
    points += 10
    reasons.push('product_launch')
  }
  if (byCategory.market_expansion) {
    points += 8
    reasons.push('market_expansion')
  }
  if (byCategory.partnership) {
    points += 8
    reasons.push('partnership')
  }
  if (byCategory.layoffs) {
    // Still a buying signal for many categories (cost cutting / vendor changes), but smaller.
    points += 6
    reasons.push('layoffs')
  }
  if (byCategory.regulatory) {
    points += 4
    reasons.push('regulatory')
  }
  if (byCategory.earnings) {
    points += 4
    reasons.push('earnings')
  }

  // Use top event score as an overall activity indicator (0..100 -> 0..20).
  const topScore = top[0]?.score ?? 0
  points += Math.round(Math.min(20, (topScore / 100) * 20))
  if (topScore >= 60) reasons.push('high_signal_event')

  // Volume bonus (bounded).
  const recentCount = events.filter((e) => e.score >= 50).length
  if (recentCount >= 3) {
    points += 6
    reasons.push('multiple_recent_events')
  } else if (recentCount >= 1) {
    points += 3
    reasons.push('recent_event')
  }

  return { points, reasons }
}

export function scoreLead(ctx: LeadScoringContext): LeadScoreResult {
  const reasons: string[] = []
  let score = 10 // baseline: known lead exists

  const eventsScore = scoreEvents(ctx.events)
  score += eventsScore.points
  reasons.push(...eventsScore.reasons)

  const engagement = scoreEngagement(ctx)
  score += engagement.points
  reasons.push(...engagement.reasons)

  const icp = scoreIcpFit(ctx)
  score += icp.points
  reasons.push(...icp.reasons)

  // Final clamp.
  const out = clampScore(score)

  // Deduplicate reasons while preserving order.
  const uniq: string[] = []
  for (const r of reasons) {
    if (!uniq.includes(r)) uniq.push(r)
    if (uniq.length >= 12) break
  }

  return { score: out, reasons: uniq }
}

export function scoreLeadDetailed(ctx: LeadScoringContext): LeadScoreDetailedResult {
  const reasonCodes: string[] = []
  let score = 10

  const eventsScore = scoreEvents(ctx.events)
  score += eventsScore.points
  reasonCodes.push(...eventsScore.reasons)

  const engagement = scoreEngagement(ctx)
  score += engagement.points
  reasonCodes.push(...engagement.reasons)

  const icp = scoreIcpFit(ctx)
  score += icp.points
  reasonCodes.push(...icp.reasons)

  const out = clampScore(score)

  const uniq: string[] = []
  for (const r of reasonCodes) {
    if (!uniq.includes(r)) uniq.push(r)
    if (uniq.length >= 12) break
  }

  const breakdown: LeadScoreBreakdownItem[] = [
    { label: 'Trigger signals', points: eventsScore.points },
    { label: 'Engagement', points: engagement.points },
    { label: 'ICP fit', points: icp.points },
  ]

  return { score: out, reasons: uniq, reasonCodes: uniq, breakdown }
}

