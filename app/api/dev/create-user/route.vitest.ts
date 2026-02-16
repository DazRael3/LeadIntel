import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Force policy devOnly behavior without mutating process.env.NODE_ENV (which affects test/e2e infrastructure).
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env')
  return {
    ...actual,
    serverEnv: new Proxy(actual.serverEnv as unknown as Record<string | symbol, unknown>, {
      get(target, prop) {
        if (prop === 'NODE_ENV') return 'production'
        if (prop === 'DEV_SEED_SECRET') return 'dev-secret'
        return target[prop]
      },
    }),
  }
})

describe('/api/dev/create-user', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('is blocked in production by the API guard (404)', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/dev/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: 'pw' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })
})

