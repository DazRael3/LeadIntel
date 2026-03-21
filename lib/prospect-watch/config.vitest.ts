import { describe, expect, it, vi } from 'vitest'

describe('prospect watch config', () => {
  it('disabled by default', async () => {
    vi.resetModules()
    vi.stubEnv('PROSPECT_WATCH_ENABLED', '')
    const { prospectWatchEnabled } = await import('./config')
    expect(prospectWatchEnabled()).toBe(false)
  })

  it('parses review emails', async () => {
    vi.resetModules()
    vi.stubEnv('PROSPECT_WATCH_REVIEW_EMAILS', 'a@example.com, b@example.com')
    const { getReviewEmails } = await import('./config')
    expect(getReviewEmails()).toEqual(['a@example.com', 'b@example.com'])
  })
})

