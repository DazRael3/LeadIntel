import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { ErrorCode } from '@/lib/api/http'

let mockAuthedUser: { id: string; email?: string | null } | null = { id: 'user_1', email: 'team@corp.com' }
let mockGateOk = true
let mockRole: 'owner' | 'admin' | 'manager' | 'rep' | 'viewer' | null = 'owner'
let mockWorkspaceId: string | null = 'ws_1'

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => mockAuthedUser),
}))

vi.mock('@/lib/billing/require-capability', () => ({
  requireCapability: vi.fn(async () => ({ ok: mockGateOk, tier: mockGateOk ? 'team' : 'starter' })),
}))

vi.mock('@/lib/team/workspace', () => ({
  ensurePersonalWorkspace: vi.fn(async () => ({ id: mockWorkspaceId ?? 'ws_missing' })),
  getCurrentWorkspace: vi.fn(async () => (mockWorkspaceId ? { id: mockWorkspaceId } : null)),
  getWorkspaceMembership: vi.fn(async () => (mockRole ? { role: mockRole } : null)),
}))

vi.mock('@/lib/audit/log', () => ({
  logAudit: vi.fn(async () => {}),
}))

vi.mock('@/lib/review/security', () => ({
  signReviewToken: vi.fn(() => 'tok'),
}))

class FakeQuery {
  select() {
    return this
  }
  eq() {
    return this
  }
  order() {
    return this
  }
  limit() {
    return this
  }
  insert() {
    return this
  }
  update() {
    return this
  }
  is() {
    return this
  }
  single = async () => ({ data: { id: 'link_1' }, error: null })
  maybeSingle = async () => ({ data: null, error: null })
  then = async (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null })
}

vi.mock('@/lib/supabase/route', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase/route')>('@/lib/supabase/route')
  return {
    ...actual,
    createRouteClient: vi.fn(() => ({
      schema: () => ({
        from: () => new FakeQuery(),
      }),
    })),
  }
})

describe('/api/review-links', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1', email: 'team@corp.com' }
    mockGateOk = true
    mockRole = 'owner'
    mockWorkspaceId = 'ws_1'
    process.env.REVIEW_SIGNING_SECRET = 'x'.repeat(64)
  })

  it('denies when capability gate fails', async () => {
    mockGateOk = false
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/review-links', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe(ErrorCode.FORBIDDEN)
  })

  it('denies when role is not privileged', async () => {
    mockRole = 'rep'
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/review-links', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})

