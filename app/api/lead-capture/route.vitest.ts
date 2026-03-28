import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const insertMock = vi.fn(async (_row: unknown) => ({ error: null }))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
    from: vi.fn(() => ({
      insert: insertMock,
    })),
  })),
}))

describe('/api/lead-capture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts a minimal payload and writes lead capture', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'buyer@example.com',
        intent: 'demo',
        route: '/pricing',
        deviceClass: 'mobile',
        viewport: { w: 390, h: 844 },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        email: 'buyer@example.com',
        intent: 'demo',
        route: '/pricing',
        device_class: 'mobile',
        viewport_w: 390,
        viewport_h: 844,
        dedupe_key: expect.any(String),
      })
    )
  })

  it('rejects invalid payloads', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ email: 'nope', route: '' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

