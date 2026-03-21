import { describe, expect, it, vi } from 'vitest'

describe('prospect watch jobs', () => {
  it('runProspectWatch is disabled by default', async () => {
    vi.resetModules()
    vi.stubEnv('PROSPECT_WATCH_ENABLED', '0')
    vi.stubEnv('PROSPECT_WATCH_RSS_FEEDS', 'https://example.com/feed.xml')

    const { runProspectWatch } = await import('./job')
    const res = await runProspectWatch({})
    expect(res.status).toBe('skipped')
    expect(res.summary).toEqual({ reason: 'prospect_watch_disabled' })
  })

  it('runProspectWatch skips when no RSS feeds configured', async () => {
    vi.resetModules()
    vi.stubEnv('PROSPECT_WATCH_ENABLED', '1')
    vi.stubEnv('PROSPECT_WATCH_RSS_FEEDS', '')

    const { runProspectWatch } = await import('./job')
    const res = await runProspectWatch({})
    expect(res.status).toBe('skipped')
    expect(res.summary).toEqual({ reason: 'no_rss_feeds_configured' })
  })

  it('runProspectWatch skips when service role not configured', async () => {
    vi.resetModules()
    vi.stubEnv('PROSPECT_WATCH_ENABLED', '1')
    vi.stubEnv('PROSPECT_WATCH_RSS_FEEDS', 'https://example.com/feed.xml')
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const { runProspectWatch } = await import('./job')
    const res = await runProspectWatch({})
    expect(res.status).toBe('skipped')
    expect(res.summary).toEqual({ reason: 'supabase_admin_not_configured' })
  })

  it('runProspectWatchDigests skips when digests disabled', async () => {
    vi.resetModules()
    vi.stubEnv('PROSPECT_WATCH_ENABLED', '1')
    vi.stubEnv('PROSPECT_WATCH_DAILY_DIGEST_ENABLED', '0')
    vi.stubEnv('PROSPECT_WATCH_CONTENT_DIGEST_ENABLED', '0')

    const { runProspectWatchDigests } = await import('./job')
    const res = await runProspectWatchDigests({})
    expect(res.status).toBe('skipped')
    expect(res.summary).toEqual({ reason: 'digests_disabled' })
  })

  it('runProspectWatchDigests skips when no review emails configured', async () => {
    vi.resetModules()
    vi.stubEnv('PROSPECT_WATCH_ENABLED', '1')
    vi.stubEnv('PROSPECT_WATCH_DAILY_DIGEST_ENABLED', '1')
    vi.stubEnv('PROSPECT_WATCH_REVIEW_EMAILS', '')

    const { runProspectWatchDigests } = await import('./job')
    const res = await runProspectWatchDigests({})
    expect(res.status).toBe('skipped')
    expect(res.summary).toEqual({ reason: 'no_review_emails_configured' })
  })
})
