import { describe, expect, it, beforeEach } from 'vitest'
import { signReviewToken, verifyReviewToken } from '@/lib/review/security'

describe('review token signing', () => {
  beforeEach(() => {
    process.env.REVIEW_SIGNING_SECRET = 'test_review_secret'
  })

  it('signs and verifies review_link token', () => {
    const exp = Math.floor(Date.now() / 1000) + 60
    const token = signReviewToken({ v: 1, aud: 'review_link', linkId: '123e4567-e89b-12d3-a456-426614174000', exp })
    const verified = verifyReviewToken(token, 'review_link')
    expect(verified?.aud).toBe('review_link')
    expect(verified?.linkId).toBe('123e4567-e89b-12d3-a456-426614174000')
  })

  it('rejects wrong audience', () => {
    const exp = Math.floor(Date.now() / 1000) + 60
    const token = signReviewToken({ v: 1, aud: 'review_link', linkId: 'x', exp })
    expect(verifyReviewToken(token, 'review_session')).toBeNull()
  })

  it('rejects expired', () => {
    const exp = Math.floor(Date.now() / 1000) - 1
    const token = signReviewToken({ v: 1, aud: 'review_link', linkId: 'x', exp })
    expect(verifyReviewToken(token, 'review_link')).toBeNull()
  })
})

