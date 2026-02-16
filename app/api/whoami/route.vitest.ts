import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env')
  return {
    ...actual,
    // Simulate production for this route without mutating process.env.NODE_ENV (which controls test/CI behavior).
    serverEnv: new Proxy(actual.serverEnv as unknown as Record<string | symbol, unknown>, {
      get(target, prop) {
        if (prop === 'NODE_ENV') return 'production'
        return target[prop]
      },
    }),
  }
})

// Minimal auth client for withApiGuard.
vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null })),
    },
  })),
}))

describe('/api/whoami', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    // Required env for env.ts validation in tests.
    process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123'
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123'
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-openai'
  })

  it('is disabled in production (404)', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/whoami', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })
})

