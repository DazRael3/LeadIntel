import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSentryConfiguration } from './sentry-config'

describe('getSentryConfiguration', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns disabled when no DSN values are set', () => {
    vi.stubEnv('SENTRY_SDK_INSTALLED', 'false')
    vi.stubEnv('SENTRY_DSN', '')
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '')
    const cfg = getSentryConfiguration()
    expect(cfg.mode).toBe('disabled')
    expect(cfg.effectiveDsnSource).toBe('none')
  })

  it('returns enabled when server DSN is valid', () => {
    vi.stubEnv('SENTRY_SDK_INSTALLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '')
    vi.stubEnv('SENTRY_DSN', 'https://abc123@example.ingest.sentry.io/12345')
    const cfg = getSentryConfiguration()
    expect(cfg.mode).toBe('enabled')
    expect(cfg.effectiveDsnSource).toBe('server')
  })

  it('returns misconfigured for invalid DSN shape', () => {
    vi.stubEnv('SENTRY_SDK_INSTALLED', 'true')
    vi.stubEnv('SENTRY_DSN', 'not-a-dsn')
    const cfg = getSentryConfiguration()
    expect(cfg.mode).toBe('misconfigured')
    expect(cfg.messages.join(' ')).toMatch(/SENTRY_DSN is not a valid Sentry DSN URL/i)
  })

  it('returns misconfigured when DSN exists but sdk is not installed', () => {
    vi.stubEnv('SENTRY_SDK_INSTALLED', 'false')
    vi.stubEnv('SENTRY_DSN', 'https://abc123@example.ingest.sentry.io/12345')
    const cfg = getSentryConfiguration()
    expect(cfg.mode).toBe('misconfigured')
    expect(cfg.messages.join(' ')).toMatch(/@sentry\/nextjs is not installed/i)
  })
})
