import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type MockUser = { id: string; email?: string }
type MockWorkspace = {
  id: string
  name: string
  owner_user_id: string
  default_template_set_id: string | null
  created_at: string
}

const mockUser: MockUser = { id: 'user_1', email: 'user@example.com' }
const mockWorkspace: MockWorkspace = {
  id: 'ws_1',
  name: 'Workspace',
  owner_user_id: 'user_1',
  default_template_set_id: null,
  created_at: '2026-04-01T00:00:00.000Z',
}

const mockGetUserSafe = vi.fn<() => Promise<MockUser | null>>(async () => mockUser)
const mockEnsurePersonalWorkspace = vi.fn<() => Promise<void>>(async () => undefined)
const mockGetCurrentWorkspace = vi.fn<() => Promise<MockWorkspace | null>>(async () => mockWorkspace)
const mockGetActivityCounts = vi.fn<
  () => Promise<{ newLeadsSinceLastVisit: number; campaignsAwaitingAction: number }>
>(async () => ({ newLeadsSinceLastVisit: 0, campaignsAwaitingAction: 0 }))
const mockStampLeadLibrarySeen = vi.fn<() => Promise<void>>(async () => undefined)

vi.mock('@/lib/api/guard', () => ({
  withApiGuard: (
    handler: (request: NextRequest, context: { requestId: string; userId: string | null }) => Promise<Response> | Response
  ) => {
    return (request: NextRequest) => handler(request, { requestId: 'req_1', userId: mockUser.id })
  },
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: mockGetUserSafe,
}))

vi.mock('@/lib/team/workspace', () => ({
  ensurePersonalWorkspace: mockEnsurePersonalWorkspace,
  getCurrentWorkspace: mockGetCurrentWorkspace,
}))

vi.mock('@/lib/services/lead-activity', () => ({
  getActivityCounts: mockGetActivityCounts,
  stampLeadLibrarySeen: mockStampLeadLibrarySeen,
}))

describe('GET /api/lead-activity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSafe.mockResolvedValue(mockUser)
    mockGetCurrentWorkspace.mockResolvedValue(mockWorkspace)
    mockEnsurePersonalWorkspace.mockResolvedValue(undefined)
    mockGetActivityCounts.mockResolvedValue({
      newLeadsSinceLastVisit: 0,
      campaignsAwaitingAction: 0,
    })
  })

  it('returns 200 with activity summary for logged-in users', async () => {
    mockGetActivityCounts.mockResolvedValueOnce({
      newLeadsSinceLastVisit: 4,
      campaignsAwaitingAction: 2,
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-activity', { method: 'GET' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.summary).toEqual({
      newLeadsSinceLastVisit: 4,
      campaignsAwaitingAction: 2,
    })
    expect(json.data.meta).toMatchObject({
      state: 'ready',
      fallback: false,
      reason: 'activity_available',
      hasWorkspace: true,
    })
  })

  it('returns 200 empty state when no activity exists', async () => {
    mockGetActivityCounts.mockResolvedValueOnce({
      newLeadsSinceLastVisit: 0,
      campaignsAwaitingAction: 0,
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-activity', { method: 'GET' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.summary).toEqual({
      newLeadsSinceLastVisit: 0,
      campaignsAwaitingAction: 0,
    })
    expect(json.data.meta).toMatchObject({
      state: 'empty',
      fallback: false,
      reason: 'no_recent_activity',
      hasWorkspace: true,
    })
  })

  it('returns 200 fallback when workspace is missing', async () => {
    mockGetCurrentWorkspace
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-activity', { method: 'GET' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.summary).toEqual({
      newLeadsSinceLastVisit: 0,
      campaignsAwaitingAction: 0,
    })
    expect(json.data.meta).toMatchObject({
      state: 'workspace_missing',
      fallback: true,
      reason: 'workspace_not_found',
      hasWorkspace: false,
    })
  })

  it('returns 200 fallback for schema-related activity failures', async () => {
    mockGetActivityCounts.mockRejectedValueOnce({
      code: 'PGRST204',
      message: "Could not find the 'campaigns' table in the schema cache",
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-activity', { method: 'GET' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.meta).toMatchObject({
      state: 'schema_unavailable',
      fallback: true,
      reason: 'activity_schema_not_ready',
      hasWorkspace: true,
    })
  })

  it('returns 200 fallback for permission/RLS failures', async () => {
    mockGetActivityCounts.mockRejectedValueOnce({
      code: '42501',
      message: 'permission denied for table campaigns',
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-activity', { method: 'GET' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.meta).toMatchObject({
      state: 'forbidden',
      fallback: true,
      reason: 'activity_forbidden',
      hasWorkspace: true,
    })
  })

  it('returns 500 safe error envelope for unexpected failures', async () => {
    mockGetCurrentWorkspace.mockRejectedValueOnce(new Error('Boom failure'))

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/lead-activity', { method: 'GET' })
    const res = await GET(req)

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('INTERNAL_ERROR')
    expect(json.error.message).toBe('An unexpected error occurred')
    expect(String(json.error.message)).not.toContain('Boom failure')
  })
})

