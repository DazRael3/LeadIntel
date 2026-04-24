import { describe, expect, it } from 'vitest'
import { resolveUserSubscriptionTierFromStripe } from '@/lib/billing/stripe-subscription-tier'

describe('resolveUserSubscriptionTierFromStripe', () => {
  it('returns free when subscription status is not active/trialing', () => {
    expect(
      resolveUserSubscriptionTierFromStripe({
        status: 'canceled',
        stripePriceId: 'price_any',
      })
    ).toBe('free')
  })

  it('returns closer_plus when mapped from Stripe price id', () => {
    process.env.STRIPE_PRICE_ID_CLOSER_PLUS = 'price_plus_123'
    expect(
      resolveUserSubscriptionTierFromStripe({
        status: 'active',
        stripePriceId: 'price_plus_123',
      })
    ).toBe('closer_plus')
  })

  it('returns team when mapped from Stripe price id', () => {
    process.env.STRIPE_PRICE_ID_TEAM = 'price_team_123'
    expect(
      resolveUserSubscriptionTierFromStripe({
        status: 'trialing',
        stripePriceId: 'price_team_123',
      })
    ).toBe('team')
  })

  it('falls back to pro when active but price mapping is unknown', () => {
    expect(
      resolveUserSubscriptionTierFromStripe({
        status: 'active',
        stripePriceId: 'price_unknown',
      })
    ).toBe('pro')
  })
})
