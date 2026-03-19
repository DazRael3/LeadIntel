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

vi.mock('@/lib/services/workspace-policies', () => ({
  getWorkspacePolicies: vi.fn(async () => ({ policies: { invite: {}, handoffs: {}, reporting: {}, planning: {}, exports: {}, revenue: {}, audit: {} }, updatedAt: null })),
  updateWorkspacePolicies: vi.fn(async () => ({ policies: { invite: {}, handoffs: {}, reporting: {}, planning: {}, exports: {}, revenue: {}, audit: {} }, updatedAt: new Date().toISOString() })),
}))

vi.mock('@/lib/services/analytics', () => ({
  logProductEvent: vi.fn(async () => {}),
}))

vi.mock('@/lib/audit/log', () => ({
  logAudit: vi.fn(async () => {}),
}))

describe('/api/workspace/policies', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns ok with configured=false and default policies when workspace missing', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/workspace/policies', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.configured).toBe(false)
    expect(json.data?.policies).toBeTruthy()
  })
})

