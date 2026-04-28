import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

describe('observability diagnostics scripts', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('check-observability runs without throwing when optional env is missing', async () => {
    vi.stubEnv('SENTRY_SDK_INSTALLED', 'false')
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'false')

    const mod = await import('./check-observability')
    expect(() => mod.main()).not.toThrow()
  })

  it('check-observability detects PostHog project id token misuse', async () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_valid_public_token')
    vi.stubEnv('POSTHOG_PROJECT_ID', 'phc_bad_token_in_id')

    const mod = await import('./check-observability')
    const results = mod.runChecks()

    expect(results.some((r) => r.name === 'posthog' && r.status === 'fail')).toBe(true)
  })

  it('check-automation reports failures only for enabled jobs missing required config', async () => {
    vi.stubEnv('ENABLE_SITE_REPORTS', 'true')
    vi.stubEnv('SITE_REPORT_CRON_SECRET', '')

    const mod = await import('./check-automation')
    const results = mod.runChecks()

    expect(results.some((r) => r.name === 'site-reports-secret' && r.status === 'fail')).toBe(true)
  })
})
