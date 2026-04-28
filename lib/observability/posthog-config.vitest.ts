import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPosthogConfiguration } from './posthog-config'

describe('getPosthogConfiguration', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', '')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', '')
    vi.stubEnv('POSTHOG_HOST', '')
    vi.stubEnv('POSTHOG_PROJECT_ID', '')
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', '')
    vi.stubEnv('POSTHOG_API_KEY', '')
    vi.stubEnv('POSTHOG_PROJECT_API_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('supports capture-only mode without requiring private API env', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_abc123')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://app.posthog.com')

    const cfg = getPosthogConfiguration()
    expect(cfg.mode).toBe('capture_only')
    expect(cfg.analyticsCaptureConfigured).toBe(true)
    expect(cfg.privateApiConfigured).toBe(false)
    expect(cfg.messages).toEqual([])
  })

  it('flags phc token mistakenly set as project ID', () => {
    vi.stubEnv('POSTHOG_PROJECT_ID', 'phc_bad_token')
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'phx_private_api_token_123')

    const cfg = getPosthogConfiguration()
    expect(cfg.mode).toBe('misconfigured')
    expect(cfg.messages.join(' ')).toContain('POSTHOG_PROJECT_ID must be numeric')
  })

  it('allows private API when numeric project ID and API key are configured', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'false')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '')
    vi.stubEnv('POSTHOG_PROJECT_ID', '12345')
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'phx_private_api_token_123')

    const cfg = getPosthogConfiguration()
    expect(cfg.mode).toBe('private_api')
    expect(cfg.privateApiConfigured).toBe(true)
    expect(cfg.messages).toEqual([])
  })
})
