/**
 * Tier + plan identifiers (shared, client-safe).
 *
 * Note: This file must remain safe for client bundles (no process.env reads).
 */
export type Tier = 'starter' | 'closer' | 'closer_plus' | 'team'
export type PaidTier = Exclude<Tier, 'starter'>

/**
 * Stable plan identifier used for checkout + gating.
 * Backward compatibility: "pro" corresponds to the "closer" tier.
 */
export type PaidPlanId = 'pro' | 'closer_plus' | 'team'

export function planIdForTier(tier: Tier): PaidPlanId | null {
  if (tier === 'starter') return null
  if (tier === 'closer') return 'pro'
  if (tier === 'closer_plus') return 'closer_plus'
  return 'team'
}

export function tierLabel(tier: Tier): string {
  switch (tier) {
    case 'starter':
      return 'Starter'
    case 'closer':
      return 'Closer'
    case 'closer_plus':
      return 'Closer+'
    case 'team':
      return 'Team'
  }
}

export function tierAtLeast(tier: Tier, required: PaidTier): boolean {
  const rank = (t: Tier): number => {
    switch (t) {
      case 'starter':
        return 0
      case 'closer':
        return 1
      case 'closer_plus':
        return 2
      case 'team':
        return 3
    }
  }
  return rank(tier) >= rank(required)
}

