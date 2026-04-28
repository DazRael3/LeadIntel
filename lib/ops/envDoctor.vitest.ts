import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runEnvDoctor } from './envDoctor'

describe('runEnvDoctor posthog states', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('POSTHOG_PROJECT_ID', '')
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', '')
    vi.stubEnv('POSTHOG_API_KEY', '')
    vi.stubEnv('POSTHOG_PROJECT_API_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'false')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not mark posthog missing for capture-only configuration', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_public_token')
    const report = runEnvDoctor()
    const posthog = report.subsystems.find((s) => s.key === 'posthog')
    expect(posthog?.configured).toBe(false)
    expect(posthog?.missingKeys ?? []).toEqual([])
    expect(posthog?.impact).toMatch(/capture/i)
  })

  it('marks posthog missing when private API is partially configured', () => {
    vi.stubEnv('POSTHOG_PROJECT_ID', '1234')
    const report = runEnvDoctor()
    const posthog = report.subsystems.find((s) => s.key === 'posthog')
    expect(posthog?.missingKeys.join(' ')).toMatch(/POSTHOG_PERSONAL_API_KEY|POSTHOG_API_KEY/i)
  })

  it('does not mark stripe as unconfigured when stripe env is present', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_123')
    vi.stubEnv('STRIPE_PRICE_ID_PRO', 'price_pro_123')
    vi.stubEnv('STRIPE_PRICE_ID_CLOSER_ANNUAL', 'price_pro_annual_123')
    vi.stubEnv('STRIPE_PRICE_ID_CLOSER_PLUS', 'price_plus_123')
    vi.stubEnv('STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL', 'price_plus_annual_123')
    vi.stubEnv('STRIPE_PRICE_ID_TEAM', 'price_team_123')
    vi.stubEnv('STRIPE_PRICE_ID_TEAM_ANNUAL', 'price_team_annual_123')

    const report = runEnvDoctor()
    const stripe = report.subsystems.find((s) => s.key === 'stripe')
    expect(stripe?.configured).toBe(true)
    expect(stripe?.missingKeys ?? []).toEqual([])
  })
})
