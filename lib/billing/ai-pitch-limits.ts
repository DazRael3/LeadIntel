import type { Tier } from '@/lib/billing/resolve-tier'

export type AiPitchLimitWindow = 'monthly'

export type AiPitchTierLimit = {
  window: AiPitchLimitWindow
  limit: number | null
}

const AI_PITCH_LIMITS_BY_TIER: Record<Tier, AiPitchTierLimit> = {
  starter: { window: 'monthly', limit: 10 },
  closer: { window: 'monthly', limit: 200 },
  closer_plus: { window: 'monthly', limit: 600 },
  team: { window: 'monthly', limit: null },
}

export function getAiPitchLimitForTier(tier: Tier): AiPitchTierLimit {
  return AI_PITCH_LIMITS_BY_TIER[tier]
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
