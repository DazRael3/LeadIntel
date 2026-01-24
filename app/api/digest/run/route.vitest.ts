import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'user_settings') {
        return {
          select: () => ({
            eq: async () => ({ data: [{ user_id: 'user_1', digest_enabled: true, digest_webhook_url: null }], error: null }),
          }),
          update: () => ({
            eq: async () => ({ data: null, error: null }),
          }),
        }
      }
      if (table === 'pitches') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                order: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  })),
}))

describe('/api/digest/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects when not cron and admin secret missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/digest/run', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': 'invalid' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('allows cron call with valid x-cron-secret without Supabase session', async () => {
    process.env.CRON_SECRET = 'test-cron-secret-123456'
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/digest/run', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': 'test-cron-secret-123456' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data.summaries)).toBe(true)
  })
})

