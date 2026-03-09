import { describe, expect, it } from 'vitest'
import { apiKeyPrefix, extractBearerToken, hashPlatformKey } from '@/lib/platform-api/auth'
import type { NextRequest } from 'next/server'

describe('platform-api/auth helpers', () => {
  it('extractBearerToken reads Authorization header', () => {
    const req = new Request('https://example.com', { headers: { Authorization: 'Bearer li_sk_test' } })
    // NextRequest is not required for this helper shape in tests; it reads headers only.
    const token = extractBearerToken({ headers: req.headers } as unknown as NextRequest)
    expect(token).toBe('li_sk_test')
  })

  it('apiKeyPrefix is stable', () => {
    expect(apiKeyPrefix('li_sk_abcdef123456')).toBe('li_sk_abcde')
  })

  it('hashPlatformKey is deterministic', () => {
    const h1 = hashPlatformKey({ rawKey: 'li_sk_x', pepper: 'pepper' })
    const h2 = hashPlatformKey({ rawKey: 'li_sk_x', pepper: 'pepper' })
    expect(h1).toEqual(h2)
    expect(h1).toMatch(/^[a-f0-9]{64}$/)
  })
})

