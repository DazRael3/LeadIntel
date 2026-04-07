import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string; email?: string | null } | null = { id: 'user_1', email: 'team@example.com' }
let mockGateOk = true
let mockWorkspaceId: string | null = 'ws_1'
let mockMembershipRole: 'owner' | 'admin' | 'manager' | 'rep' | 'viewer' | null = 'owner'
let mockJobsError: { message?: string; code?: string } | null = null
let mockJobsData: Array<Record<string, unknown>> = []

class FakeExportJobsQuery {
  select() {
    return this
  }
  eq() {
    return this
  }
  order() {
    return this
  }
  limit = async () => ({ data: mockJobsData, error: mockJobsError })
}

vi.mock('@/lib/api/guard', () => ({
  withApiGuard: (handler: (req: NextRequest, ctx: { requestId: string; userId?: string }) => Promise<Response>) => {
    return (req: NextRequest) => handler(req, { requestId: 'req_1', userId: mockAuthedUser?.id })
  },
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    schema: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table !== 'export_jobs') throw new Error(`unexpected table ${table}`)
        return new FakeExportJobsQuery()
      }),
    })),
  })),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => mockAuthedUser),
}))

vi.mock('@/lib/billing/require-capability', () => ({
  requireCapability: vi.fn(async () => ({ ok: mockGateOk, tier: mockGateOk ? 'team' : 'starter' })),
}))

vi.mock('@/lib/team/workspace', () => ({
  getCurrentWorkspace: vi.fn(async () => (mockWorkspaceId ? { id: mockWorkspaceId } : null)),
  getWorkspaceMembership: vi.fn(async () => (mockMembershipRole ? { role: mockMembershipRole } : null)),
}))

describe('/api/exports/jobs', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1', email: 'team@example.com' }
    mockGateOk = true
    mockWorkspaceId = 'ws_1'
    mockMembershipRole = 'owner'
    mockJobsError = null
    mockJobsData = []
  })

  it('returns 409 with explicit reason when workspace is unavailable', async () => {
    mockWorkspaceId = null
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/exports/jobs', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('CONFLICT')
    expect(json.error?.details?.reason).toBe('WORKSPACE_UNAVAILABLE')
  })

  it('returns 424 for schema exposure errors', async () => {
    mockJobsError = { code: 'PGRST106', message: 'The schema must be one of the following: public' }
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/exports/jobs', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(424)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('SCHEMA_MIGRATION_REQUIRED')
    expect(json.error?.details?.reason).toBe('SCHEMA_NOT_EXPOSED')
  })

  it('returns jobs when query succeeds', async () => {
    mockJobsData = [{ id: 'job_1', type: 'accounts', status: 'pending', created_at: new Date().toISOString() }]
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/exports/jobs', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data?.jobs)).toBe(true)
    expect(json.data?.jobs?.length).toBe(1)
  })
})
