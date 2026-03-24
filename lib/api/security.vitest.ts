import { describe, expect, it, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

describe('validateOrigin', () => {
  beforeEach(() => {
    // Reset between tests so env changes don't leak.
    vi.resetModules()
  })

  it('allows www variant when site URL is apex', async () => {
    const oldEnv = process.env
    process.env = {
      ...oldEnv,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://dazrael.com',
    }
    const { validateOrigin } = await import('./security')
    const req = new NextRequest('https://dazrael.com/api/sample-digest', {
      method: 'POST',
      headers: { origin: 'https://www.dazrael.com' },
    })
    const res = validateOrigin(req, '/api/sample-digest')
    expect(res).toBeNull()
    process.env = oldEnv
  })

  it('rejects unrelated origins with a 403 envelope', async () => {
    const oldEnv = process.env
    process.env = {
      ...oldEnv,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SITE_URL: 'https://dazrael.com',
    }
    const { validateOrigin } = await import('./security')
    const req = new NextRequest('https://dazrael.com/api/sample-digest', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    })
    const res = validateOrigin(req, '/api/sample-digest')
    expect(res).not.toBeNull()
    expect(res?.status).toBe(403)
    const json = await res!.json()
    expect(json).toMatchObject({ ok: false })
    process.env = oldEnv
  })
})

