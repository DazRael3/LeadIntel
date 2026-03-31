import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/services/triggerEvents', () => ({
  ingestRealTriggerEvents: vi.fn(async () => ({ created: 1 })),
}))

let mockLeadsError: { message: string } | null = null

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table !== 'leads') throw new Error(`unexpected table: ${table}`)
      return {
        select: () => ({
          limit: () => ({
            eq: () => ({
              eq: async () => ({
                data: mockLeadsError
                  ? null
                  : [{ id: 'lead_1', user_id: 'user_1', company_name: 'Lego', company_domain: 'lego.com' }],
                error: mockLeadsError,
              }),
            }),
          }),
        }),
      }
    },
  })),
}))

describe('/api/trigger-events/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockLeadsError = null
    process.env.TRIGGER_EVENTS_CRON_SECRET = 'secret-1234567890abcdef'
  })

  it('rejects when secret is invalid', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/trigger-events/ingest', {
      method: 'POST',
      body: JSON.stringify({ companyDomain: 'lego.com' }),
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': 'nope' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('does not leak DB error messages', async () => {
    mockLeadsError = { message: 'leaky_db_error: secret=sk_test_123' }
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/trigger-events/ingest', {
      method: 'POST',
      body: JSON.stringify({ companyDomain: 'lego.com', companyName: 'Lego' }),
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': 'secret-1234567890abcdef' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(String(json.error?.details ?? '')).not.toContain('sk_test_123')
    expect(String(json.error?.message ?? '')).not.toContain('leaky_db_error')
  })

  it('calls ingestRealTriggerEvents when secret is valid', async () => {
    const { POST } = await import('./route')
    const { ingestRealTriggerEvents } = await import('@/lib/services/triggerEvents')

    const req = new NextRequest('http://localhost:3000/api/trigger-events/ingest', {
      method: 'POST',
      body: JSON.stringify({ companyDomain: 'lego.com', companyName: 'Lego' }),
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': 'secret-1234567890abcdef' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(ingestRealTriggerEvents).toHaveBeenCalled()
  })
})

