import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
    },
  })),
}))

// Force policy devOnly behavior without mutating process.env.NODE_ENV (which affects other test infrastructure).
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env')
  return {
    ...actual,
    serverEnv: new Proxy(actual.serverEnv as unknown as Record<string | symbol, unknown>, {
      get(target, prop) {
        if (prop === 'NODE_ENV') return 'production'
        // satisfy dev-only guard secret lookup (won't be used in prod)
        if (prop === 'DEV_SEED_SECRET') return 'dev-secret'
        return target[prop]
      },
    }),
  }
})

describe('/api/test-error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('is blocked in production by the API guard (404)', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/test-error', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })
})

