import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn(async () => ({ data: null, error: null })),
      limit: vi.fn().mockReturnThis(),
    })),
  })),
}))

describe('/api/resend/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid signature before any DB writes', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
    const { POST } = await import('./route')

    const req = new NextRequest('http://localhost:3000/api/resend/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'email.delivered', data: { id: 'email_123' } }),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_1',
        'svix-timestamp': '1700000000',
        'svix-signature': 'v1,invalid',
      },
    })

    const res = await POST(req)
    expect([400, 401]).toContain(res.status)
    expect(vi.mocked(createSupabaseAdminClient)).not.toHaveBeenCalled()
  })

  it('accepts valid signature and proceeds to handler logic', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
    const { POST } = await import('./route')

    const secret = process.env.RESEND_WEBHOOK_SECRET || 'test-resend-webhook-secret'
    const payload = { type: 'email.delivered', data: { id: 'email_123' } }
    const raw = Buffer.from(JSON.stringify(payload))
    const svixId = 'msg_1'
    const svixTimestamp = String(Math.floor(Date.now() / 1000))
    const toSign = `${svixId}.${svixTimestamp}.${raw.toString('utf-8')}`
    const sig = crypto.createHmac('sha256', secret).update(toSign).digest('base64')

    const req = new NextRequest('http://localhost:3000/api/resend/webhook', {
      method: 'POST',
      body: raw,
      headers: {
        'Content-Type': 'application/json',
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': `v1,${sig}`,
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(vi.mocked(createSupabaseAdminClient)).toHaveBeenCalled()
  })
})

