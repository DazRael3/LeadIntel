import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetCurrentWorkspace = vi.fn<(..._args: unknown[]) => Promise<{ id: string } | null>>(async () => null)
const mockGetWorkspaceMembership = vi.fn<(..._args: unknown[]) => Promise<{ role: 'owner' | 'admin' | 'member' } | null>>(async () => ({
  role: 'owner',
}))

let mockActorEmail = 'actor@corp.com'

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1', email: mockActorEmail } }, error: null })),
    },
  })),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => ({ id: 'user_1', email: mockActorEmail })),
}))

vi.mock('@/lib/team/workspace', () => ({
  getCurrentWorkspace: (...args: unknown[]) => mockGetCurrentWorkspace(...args),
  getWorkspaceMembership: (...args: unknown[]) => mockGetWorkspaceMembership(...args),
}))

let mockOverridesRows: unknown[] = []
let mockUsersInRows: Array<{ id: string; email: string }> = []
let mockUserByEmailId: string | null = 'target_1'

const mockAdmin = {
  from: vi.fn((table: string) => {
    if (table === 'qa_tier_overrides') {
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: mockOverridesRows, error: null })),
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
            limit: vi.fn(async () => ({ data: mockUsersInRows, error: null })),
          })),
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: typeof mockUserByEmailId === 'string' ? { id: mockUserByEmailId } : null,
              error: null,
            })),
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
    mockActorEmail = 'actor@corp.com'
    mockGetCurrentWorkspace.mockResolvedValue(null)
    mockGetWorkspaceMembership.mockResolvedValue({ role: 'owner' })
    mockOverridesRows = []
    mockUsersInRows = []
    mockUserByEmailId = 'target_1'
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

  it('forbids GET when actor not allowlisted', async () => {
    process.env.QA_OVERRIDE_ACTOR_EMAILS = 'other@corp.com'
    process.env.QA_OVERRIDE_TARGET_EMAILS = 'qa@corp.com'
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })

  it('returns ok envelope (enabled=false) when QA overrides disabled', async () => {
    process.env.ENABLE_QA_OVERRIDES = 'false'
    process.env.QA_OVERRIDE_ACTOR_EMAILS = 'actor@corp.com'
    process.env.QA_OVERRIDE_TARGET_EMAILS = 'qa@corp.com'
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.enabled).toBe(false)
    expect(json.data?.configured).toBe(false)
    expect(Array.isArray(json.data?.overrides)).toBe(true)
  })

  it('includes applied-by display + target email when rows present', async () => {
    process.env.QA_OVERRIDE_ACTOR_EMAILS = 'actor@corp.com'
    process.env.QA_OVERRIDE_TARGET_EMAILS = 'qa@corp.com'
    mockOverridesRows = [
      {
        id: 'ov_1',
        target_user_id: 'target_1',
        override_tier: 'team',
        expires_at: null,
        created_by: 'user_1',
        created_at: new Date().toISOString(),
        revoked_at: null,
        revoked_by: null,
        note: null,
      },
    ]
    mockUsersInRows = [
      { id: 'target_1', email: 'qa@corp.com' },
      { id: 'user_1', email: 'actor@corp.com' },
    ]
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.overrides?.[0]?.target_email).toBe('qa@corp.com')
    expect(json.data?.overrides?.[0]?.created_by_display).toBe('You')
  })
})

describe('/api/qa/overrides apply/revoke', () => {
  beforeEach(() => {
    vi.resetModules()
    mockActorEmail = 'actor@corp.com'
    process.env.ENABLE_QA_OVERRIDES = 'true'
    process.env.QA_OVERRIDE_ACTOR_EMAILS = 'actor@corp.com'
    process.env.QA_OVERRIDE_TARGET_EMAILS = 'qa@corp.com'
    mockGetCurrentWorkspace.mockResolvedValue({ id: 'ws_1' })
    mockGetWorkspaceMembership.mockResolvedValue({ role: 'owner' })
    mockOverridesRows = []
    mockUsersInRows = []
    mockUserByEmailId = 'target_1'
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

  it('POST fails closed with 503 when misconfigured', async () => {
    delete process.env.QA_OVERRIDE_ACTOR_EMAILS
    delete process.env.QA_OVERRIDE_TARGET_EMAILS
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetEmail: 'qa@corp.com', tier: 'team', expiresInMinutes: 30 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })

  it('POST returns 404 when disabled', async () => {
    process.env.ENABLE_QA_OVERRIDES = 'false'
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetEmail: 'qa@corp.com', tier: 'team', expiresInMinutes: 30 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })

  it('POST rejects when actor not allowlisted', async () => {
    mockActorEmail = 'not@corp.com'
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetEmail: 'qa@corp.com', tier: 'team', expiresInMinutes: 30 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })

  it('POST rejects when target not allowlisted', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetEmail: 'not-allowlisted@corp.com', tier: 'team', expiresInMinutes: 30 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })

  it('POST returns 422 when workspace missing', async () => {
    mockGetCurrentWorkspace.mockResolvedValueOnce(null)
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetEmail: 'qa@corp.com', tier: 'team', expiresInMinutes: 30 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.ok).toBe(false)
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

  it('DELETE returns 404 when disabled', async () => {
    process.env.ENABLE_QA_OVERRIDES = 'false'
    const { DELETE } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetEmail: 'qa@corp.com' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })

  it('DELETE fails closed with 503 when misconfigured', async () => {
    delete process.env.QA_OVERRIDE_ACTOR_EMAILS
    delete process.env.QA_OVERRIDE_TARGET_EMAILS
    const { DELETE } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetEmail: 'qa@corp.com' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })

  it('DELETE returns 422 when workspace missing', async () => {
    mockGetCurrentWorkspace.mockResolvedValueOnce(null)
    const { DELETE } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/qa/overrides', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetEmail: 'qa@corp.com' }),
    })
    const res = await DELETE(req)
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.ok).toBe(false)
  })
})

