import { describe, expect, it, vi, beforeEach } from 'vitest'

describe('feature flags', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.FEATURE_AUTOPILOT_ENABLED
  })

  it('defaults to enabled when unset', async () => {
    const { isFeatureEnabled } = await import('./feature-flags')
    expect(await isFeatureEnabled('autopilot_sends')).toBe(true)
  })

  it('env disables globally with 0/false', async () => {
    process.env.FEATURE_AUTOPILOT_ENABLED = '0'
    const { isFeatureEnabled } = await import('./feature-flags')
    expect(await isFeatureEnabled('autopilot_sends')).toBe(false)

    vi.resetModules()
    process.env.FEATURE_AUTOPILOT_ENABLED = 'false'
    const { isFeatureEnabled: isFeatureEnabled2 } = await import('./feature-flags')
    expect(await isFeatureEnabled2('autopilot_sends')).toBe(false)
  })

  it('env enables with 1/true', async () => {
    process.env.FEATURE_AUTOPILOT_ENABLED = '1'
    const { isFeatureEnabled } = await import('./feature-flags')
    expect(await isFeatureEnabled('autopilot_sends')).toBe(true)
  })

  it('tenant override takes precedence when present (unless env hard-off)', async () => {
    process.env.FEATURE_CLEARBIT_ENABLED = 'true'
    const { isFeatureEnabled } = await import('./feature-flags')

    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { feature: 'clearbit_enrichment', enabled: false }, error: null }),
            }),
          }),
        }),
      }),
    } as any

    expect(await isFeatureEnabled('clearbit_enrichment', { tenantId: 'tenant_1', supabase })).toBe(false)

    // Global hard-off always wins, even if tenant tries to enable.
    vi.resetModules()
    process.env.FEATURE_CLEARBIT_ENABLED = '0'
    const { isFeatureEnabled: isFeatureEnabled2 } = await import('./feature-flags')
    const supabaseEnable = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { feature: 'clearbit_enrichment', enabled: true }, error: null }),
            }),
          }),
        }),
      }),
    } as any
    expect(await isFeatureEnabled2('clearbit_enrichment', { tenantId: 'tenant_1', supabase: supabaseEnable })).toBe(false)
  })
})

