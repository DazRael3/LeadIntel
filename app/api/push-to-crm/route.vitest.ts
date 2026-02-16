import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null })),
    },
    from: (table: string) => {
      if (table !== 'feature_flags') throw new Error('unexpected table')
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { feature: 'zapier_push', enabled: false }, error: null }),
            }),
          }),
        }),
      }
    },
  })),
}))

describe('/api/push-to-crm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 503 when tenant override disables zapier_push', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as any)
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/push-to-crm', {
      method: 'POST',
      body: JSON.stringify({ company_name: 'Acme' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(503)
    expect((globalThis.fetch as any)).not.toHaveBeenCalled()
  })
})

