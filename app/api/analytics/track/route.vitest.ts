import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { logProductEvent } from '@/lib/services/analytics'

vi.mock('@/lib/services/analytics', () => ({
  logProductEvent: vi.fn(async () => {}),
}))

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<any>('@/lib/env')
  return {
    ...actual,
    serverEnv: new Proxy(
      { ENABLE_PRODUCT_ANALYTICS: 'true' },
      {
        get(target, prop) {
          return (target as any)[prop]
        },
      }
    ),
  }
})

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null })),
    },
  })),
}))

const logProductEventMock = vi.mocked(logProductEvent)

describe('/api/analytics/track', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs an event when enabled', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ eventName: 'pricing_cta_clicked', eventProps: { src: 'pricing' } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(logProductEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        eventName: 'pricing_cta_clicked',
      })
    )
  })
})

