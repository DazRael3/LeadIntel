import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null })),
    },
    from: (table: string) => {
      if (table === 'feature_flags') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { feature: 'clearbit_enrichment', enabled: false }, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { subscription_tier: 'pro' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'website_visitors') {
        return { insert: async () => ({ data: null, error: null }) }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  })),
}))

describe('/api/reveal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 503 when tenant override disables clearbit_enrichment', async () => {
    vi.stubGlobal('fetch', vi.fn() as any)
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/reveal', {
      method: 'POST',
      body: JSON.stringify({ visitor_ip: '8.8.8.8' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(503)
    expect((globalThis.fetch as any)).not.toHaveBeenCalled()
  })
})

