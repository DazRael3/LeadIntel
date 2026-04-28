import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getAutomationJobConfig } from './automation-config'

describe('automation-config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('marks optional jobs as disabled by default', () => {
    const jobs = getAutomationJobConfig({ hasEnabledWebhookEndpoints: false })
    const lifecycle = jobs.find((job) => job.job === 'lifecycle')
    const growth = jobs.find((job) => job.job === 'growth_cycle')
    const digest = jobs.find((job) => job.job === 'digest_lite')
    expect(lifecycle?.enabled).toBe(false)
    expect(growth?.enabled).toBe(false)
    expect(digest?.enabled).toBe(false)
  })

  it('enables prospect watch jobs when prospect flags are set', () => {
    vi.stubEnv('PROSPECT_WATCH_ENABLED', 'true')
    vi.stubEnv('PROSPECT_WATCH_DAILY_DIGEST_ENABLED', 'true')
    const jobs = getAutomationJobConfig({ hasEnabledWebhookEndpoints: false })
    const prospect = jobs.find((job) => job.job === 'prospect_watch')
    const digest = jobs.find((job) => job.job === 'prospect_watch_digest')
    expect(prospect?.enabled).toBe(true)
    expect(digest?.enabled).toBe(true)
  })
})
