import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<unknown>('@/lib/env')
  return {
    ...(actual as object),
    serverEnv: new Proxy(
      {
        NODE_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://dazrael.com',
      },
      {
        get(target, prop) {
          return (target as any)[prop]
        },
      }
    ),
  }
})

describe('validateOrigin', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('allows www variant when site URL is apex', async () => {
    const { validateOrigin } = await import('./security')
    const req = new NextRequest('https://dazrael.com/api/sample-digest', {
      method: 'POST',
      headers: { origin: 'https://www.dazrael.com' },
    })
    const res = validateOrigin(req, '/api/sample-digest')
    expect(res).toBeNull()
  })

  it('rejects unrelated origins with a 403 envelope', async () => {
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
  })
})

