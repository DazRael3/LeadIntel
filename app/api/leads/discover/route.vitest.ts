import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = null

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
  })),
}))

describe('/api/leads/discover', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = null
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    process.env.CRON_SECRET = 'cron_secret_123456' // >= 16 chars (env schema requirement)
  })

  it('unauthenticated without cron -> 401', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/leads/discover', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('cron secret bypass -> 200', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/leads/discover', {
      method: 'POST',
      headers: { 'x-cron-secret': 'cron_secret_123456' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.message).toContain('not configured')
  })
})

