import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1', email: 'actor@corp.com' } }, error: null })),
    },
  })),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => ({ id: 'user_1', email: 'actor@corp.com' })),
}))

vi.mock('@/lib/team/workspace', () => ({
  getCurrentWorkspace: vi.fn(async () => ({ id: 'ws_1' })),
  getWorkspaceMembership: vi.fn(async () => ({ role: 'owner' })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  })),
}))

vi.mock('@/lib/audit/log', () => ({ logAudit: vi.fn(async () => {}) }))

describe('/api/qa/overrides allowlist hardening', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.QA_OVERRIDE_ACTOR_EMAILS
    delete process.env.QA_OVERRIDE_TARGET_EMAILS
    process.env.ENABLE_QA_OVERRIDES = 'true'
  })

  it('returns ok envelope (configured=false) when allowlists missing', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.configured).toBe(false)
  })
})

