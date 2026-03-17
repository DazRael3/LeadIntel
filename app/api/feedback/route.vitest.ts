import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const insertMock = vi.fn(async () => ({ error: null }))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null })),
    },
    from: vi.fn(() => ({
      insert: insertMock,
    })),
  })),
}))

describe('/api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts a minimal payload and writes feedback', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        route: '/support',
        surface: 'support',
        sentiment: 'up',
        message: 'Clear and helpful.',
        deviceClass: 'mobile',
        viewport: { w: 390, h: 844 },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user_1',
        route: '/support',
        surface: 'support',
        sentiment: 'up',
        device_class: 'mobile',
        viewport_w: 390,
        viewport_h: 844,
      })
    )
  })

  it('rejects invalid payloads', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        route: '',
        surface: 'support',
        sentiment: 'maybe',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

