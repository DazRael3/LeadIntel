import { describe, expect, it } from 'vitest'
import type { RoutePolicy } from './policy'
import { getRoutePolicy } from './policy'
import { resolvePolicyRateLimit } from './ratelimit-policy'

function makePolicy(overrides: Partial<RoutePolicy>): RoutePolicy {
  return {
    tier: 'D',
    maxBytes: 0,
    rateLimit: {
      authPerMin: 30,
      ipPerMin: 60,
    },
    originRequired: false,
    authRequired: false,
    cronAllowed: false,
    devOnly: false,
    webhookSignatureRequired: false,
    ...overrides,
  }
}

describe('resolvePolicyRateLimit', () => {
  it('uses ip limit for anonymous requests', () => {
    const policy = makePolicy({ rateLimit: { authPerMin: 10, ipPerMin: 40 } })
    expect(resolvePolicyRateLimit(policy, false)).toBe(40)
  })

  it('uses auth limit when set for authenticated requests', () => {
    const policy = makePolicy({ rateLimit: { authPerMin: 25, ipPerMin: 40 } })
    expect(resolvePolicyRateLimit(policy, true)).toBe(25)
  })

  it('falls back to ip limit for public routes when auth limit is unset', () => {
    const policy = makePolicy({ authRequired: false, rateLimit: { authPerMin: 0, ipPerMin: 60 } })
    expect(resolvePolicyRateLimit(policy, true)).toBe(60)
  })

  it('keeps zero auth limit for auth-required routes', () => {
    const policy = makePolicy({ authRequired: true, rateLimit: { authPerMin: 0, ipPerMin: 60 } })
    expect(resolvePolicyRateLimit(policy, true)).toBe(0)
  })

  it('keeps /api/public/automation limits non-zero for both anonymous and authenticated callers', () => {
    const policy = getRoutePolicy('/api/public/automation', 'GET')
    expect(resolvePolicyRateLimit(policy, false)).toBe(60)
    expect(resolvePolicyRateLimit(policy, true)).toBe(60)
  })
})
