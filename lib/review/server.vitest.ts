import { describe, expect, it, vi, beforeEach } from 'vitest'

describe('isReviewMode (server)', () => {
  const headersModPath = 'next/headers'

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.REVIEW_SIGNING_SECRET = 'test-review-signing-secret-32-bytes-minimum!!'
  })

  it('returns false when cookie is missing', async () => {
    vi.doMock(headersModPath, () => ({
      cookies: async () => ({
        get: () => undefined,
      }),
    }))

    const { isReviewMode } = await import('./server')
    expect(await isReviewMode()).toBe(false)
  })

  it('returns false when cookie is tampered', async () => {
    vi.doMock(headersModPath, () => ({
      cookies: async () => ({
        get: () => ({ value: 'not-a-valid-token' }),
      }),
    }))

    const { isReviewMode } = await import('./server')
    expect(await isReviewMode()).toBe(false)
  })

  it('returns false when cookie is expired', async () => {
    const { signReviewToken } = await import('@/lib/review/security')
    const expired = signReviewToken({ v: 1, aud: 'review_session', linkId: 'link_1', exp: Math.floor(Date.now() / 1000) - 10 })

    vi.doMock(headersModPath, () => ({
      cookies: async () => ({
        get: () => ({ value: expired }),
      }),
    }))

    const { isReviewMode } = await import('./server')
    expect(await isReviewMode()).toBe(false)
  })
})

