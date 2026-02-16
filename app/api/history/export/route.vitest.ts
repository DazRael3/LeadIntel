import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { getPlanDetails } from '@/lib/billing/plan'

vi.mock('@/lib/billing/plan', () => ({
  getPlanDetails: vi.fn(),
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null })),
    },
  })),
}))

const getPlanDetailsMock = vi.mocked(getPlanDetails)

describe('/api/history/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when plan is not pro', async () => {
    getPlanDetailsMock.mockResolvedValue({ plan: 'free' })
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/history/export', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})

