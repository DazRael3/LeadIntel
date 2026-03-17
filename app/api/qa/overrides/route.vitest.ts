import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetCurrentWorkspace = vi.fn(async () => null)
const mockGetWorkspaceMembership = vi.fn(async () => ({ role: 'owner' }))

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
  getCurrentWorkspace: (...args: unknown[]) => mockGetCurrentWorkspace(...args),
  getWorkspaceMembership: (...args: unknown[]) => mockGetWorkspaceMembership(...args),
}))

const mockAdmin = {
  from: vi.fn((table: string) => {
    if (table === 'qa_tier_overrides') {
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
        upsert: vi.fn(async () => ({ error: null })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(async () => ({ error: null })),
          })),
        })),
      }
    }

    if (table === 'users') {
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: [], error: null })),
          })),
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: { id: 'target_1' }, error: null })),
          })),
        })),
      }
    }

    return {
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          limit: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    }
  }),
}

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => mockAdmin),
}))

vi.mock('@/lib/audit/log', () => ({ logAudit: vi.fn(async () => {}) }))

describe('/api/qa/overrides allowlist hardening', () => {
  beforeEach(() => {
    vi.resetModules()
    mockGetCurrentWorkspace.mockResolvedValue(null)
    mockGetWorkspaceMembership.mockResolvedValue({ role: 'owner' })
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

  it('succeeds when configured and no workspace exists', async () => {
    process.env.QA_OVERRIDE_ACTOR_EMAILS = 'actor@corp.com'
    process.env.QA_OVERRIDE_TARGET_EMAILS = 'qa@corp.com'
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.workspace?.exists).toBe(false)
    expect(Array.isArray(json.data?.overrides)).toBe(true)
  })
})

describe('/api/qa/overrides apply/revoke', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ENABLE_QA_OVERRIDES = 'true'
    process.env.QA_OVERRIDE_ACTOR_EMAILS = 'actor@corp.com'
    process.env.QA_OVERRIDE_TARGET_EMAILS = 'qa@corp.com'
    mockGetCurrentWorkspace.mockResolvedValue({ id: 'ws_1' })
    mockGetWorkspaceMembership.mockResolvedValue({ role: 'owner' })
  })

  it('POST applies an override (ok=true)', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetEmail: 'qa@corp.com', tier: 'team', expiresInMinutes: 30, note: 'test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it('DELETE revokes an override (ok=true)', async () => {
    const { DELETE } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetEmail: 'qa@corp.com' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})

