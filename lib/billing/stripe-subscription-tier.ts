import { resolveTierFromStripePriceId } from '@/lib/billing/stripePriceMap'

export type UserSubscriptionTier = 'free' | 'pro' | 'closer_plus' | 'team'

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing'])

export function isStripeSubscriptionActiveStatus(status: string | null | undefined): boolean {
  if (typeof status !== 'string') return false
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status)
}

export function resolveUserSubscriptionTierFromStripe(args: {
  status: string | null | undefined
  stripePriceId: string | null | undefined
}): UserSubscriptionTier {
  if (!isStripeSubscriptionActiveStatus(args.status)) return 'free'

  const tier = resolveTierFromStripePriceId(args.stripePriceId)
  if (tier === 'team') return 'team'
  if (tier === 'closer_plus') return 'closer_plus'
  return 'pro'
}
