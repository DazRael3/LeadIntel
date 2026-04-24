import type { Tier } from '@/lib/billing/resolve-tier'
import { getProductPlanDetailsForTier } from '@/lib/billing/product-plan'

export type AiPitchLimitWindow = 'monthly'

export type AiPitchTierLimit = {
  window: AiPitchLimitWindow
  limit: number | null
}

export function getAiPitchLimitForTier(tier: Tier): AiPitchTierLimit {
  const plan = getProductPlanDetailsForTier(tier)
  return { window: 'monthly', limit: plan.aiPitchLimit }
}

export function getCurrentMonthlyUsageWindowStart(now: Date = new Date()): string {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString()
}

export function isAiPitchLimitReached(args: { used: number; limit: number | null }): boolean {
  if (typeof args.limit !== 'number') return false
  return args.used >= args.limit
}
