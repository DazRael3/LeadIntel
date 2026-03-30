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
  getUserTierForGating: vi.fn(async () => 'team'),
}))

vi.mock('@/lib/team/workspace', () => ({
  getCurrentWorkspace: vi.fn(async () => null),
  getWorkspaceMembership: vi.fn(async () => null),
}))

vi.mock('@/lib/services/integrations-summary', () => ({
  getWorkspaceIntegrationSummary: vi.fn(async () => ({
    workspaceId: 'ws_1',
    role: 'viewer',
    integrations: [],
    defaults: { handoffWebhookEndpointId: null },
  })),
}))

describe('/api/workspace/integrations/summary', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns ok with configured=false when workspace missing', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/workspace/integrations/summary', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.configured).toBe(false)
    expect(Array.isArray(json.data?.integrations)).toBe(true)
  })
})

