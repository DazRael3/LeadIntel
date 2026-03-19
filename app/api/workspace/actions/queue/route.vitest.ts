import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1', email: 'team@corp.com' } }, error: null })),
    },
  })),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => ({ id: 'user_1', email: 'team@corp.com' })),
}))

vi.mock('@/lib/team/gating', () => ({
  requireTeamPlan: vi.fn(async () => ({ ok: true, tier: 'team' })),
}))

vi.mock('@/lib/team/workspace', () => ({
  getCurrentWorkspace: vi.fn(async () => null),
  getWorkspaceMembership: vi.fn(async () => null),
}))

vi.mock('@/lib/services/action-queue', () => ({
  listActionQueueItems: vi.fn(async () => []),
}))

vi.mock('@/lib/services/analytics', () => ({
  logProductEvent: vi.fn(async () => {}),
}))

describe('/api/workspace/actions/queue', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns ok(items=[]) when workspace missing (no 500)', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/workspace/actions/queue?status=ready&limit=5', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data?.items)).toBe(true)
  })
})

