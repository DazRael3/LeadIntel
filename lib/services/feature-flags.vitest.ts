import { describe, expect, it, vi, beforeEach } from 'vitest'

describe('feature flags', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.FEATURE_AUTOPILOT_ENABLED
  })

  it('defaults to enabled when unset', async () => {
    const { isFeatureEnabled } = await import('./feature-flags')
    expect(isFeatureEnabled('autopilot_sends')).toBe(true)
  })

  it('env disables globally with 0/false', async () => {
    process.env.FEATURE_AUTOPILOT_ENABLED = '0'
    const { isFeatureEnabled } = await import('./feature-flags')
    expect(isFeatureEnabled('autopilot_sends')).toBe(false)

    vi.resetModules()
    process.env.FEATURE_AUTOPILOT_ENABLED = 'false'
    const { isFeatureEnabled: isFeatureEnabled2 } = await import('./feature-flags')
    expect(isFeatureEnabled2('autopilot_sends')).toBe(false)
  })

  it('env enables with 1/true', async () => {
    process.env.FEATURE_AUTOPILOT_ENABLED = '1'
    const { isFeatureEnabled } = await import('./feature-flags')
    expect(isFeatureEnabled('autopilot_sends')).toBe(true)
  })
})

