import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { listActionQueueItems } from '@/lib/services/action-queue'

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

vi.mock('@/lib/billing/require-capability', () => ({
  requireCapability: vi.fn(async () => ({ ok: true, tier: 'team' })),
}))

vi.mock('@/lib/team/gating', () => ({
  requireTeamPlan: vi.fn(async () => ({ ok: true, tier: 'team' })),
  getUserTierForGating: vi.fn(async () => 'team'),
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

const requireCapabilityMock = vi.mocked(requireCapability)
const getCurrentWorkspaceMock = vi.mocked(getCurrentWorkspace)
const getWorkspaceMembershipMock = vi.mocked(getWorkspaceMembership)
const listActionQueueItemsMock = vi.mocked(listActionQueueItems)
const mockWorkspace = {
  id: 'ws_1',
  name: 'Workspace',
  owner_user_id: 'user_1',
  default_template_set_id: null,
  created_at: '2026-04-01T00:00:00.000Z',
}

describe('/api/workspace/actions/queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireCapabilityMock.mockResolvedValue({ ok: true, tier: 'team' })
    getCurrentWorkspaceMock.mockResolvedValue(null)
    getWorkspaceMembershipMock.mockResolvedValue(null)
    listActionQueueItemsMock.mockResolvedValue([])
  })

  it('returns ok(items=[]) when workspace missing (no 500)', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/workspace/actions/queue?status=ready&limit=5', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data?.items)).toBe(true)
    expect(json.data?.meta?.state).toBe('workspace_missing')
  })

  it('returns 200 empty queue when workspace and membership exist but no actions', async () => {
    getCurrentWorkspaceMock.mockResolvedValueOnce(mockWorkspace)
    getWorkspaceMembershipMock.mockResolvedValueOnce({ role: 'owner' })
    listActionQueueItemsMock.mockResolvedValueOnce([])

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/workspace/actions/queue?status=all&limit=50', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.meta?.state).toBe('empty')
    expect(Array.isArray(json.data?.items)).toBe(true)
    expect(json.data.items).toHaveLength(0)
  })

  it('returns 200 fallback when capability is unavailable (upgrade state)', async () => {
    requireCapabilityMock.mockResolvedValueOnce({ ok: false, tier: 'starter' })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/workspace/actions/queue?status=all&limit=50', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.meta?.state).toBe('upgrade_required')
    expect(Array.isArray(json.data?.items)).toBe(true)
    expect(json.data.items).toHaveLength(0)
  })

  it('returns 200 fallback for expected RLS permission errors from queue reads', async () => {
    getCurrentWorkspaceMock.mockResolvedValueOnce(mockWorkspace)
    getWorkspaceMembershipMock.mockResolvedValueOnce({ role: 'owner' })
    listActionQueueItemsMock.mockRejectedValueOnce({
      code: '42501',
      message: 'permission denied for table action_queue_items',
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/workspace/actions/queue?status=all&limit=50', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.meta?.state).toBe('restricted')
    expect(Array.isArray(json.data?.items)).toBe(true)
    expect(json.data.items).toHaveLength(0)
  })

  it('returns 200 fallback for schema-related workspace resolution errors', async () => {
    getCurrentWorkspaceMock.mockRejectedValueOnce({
      code: 'PGRST106',
      message: 'The schema must be one of the following: public',
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/workspace/actions/queue?status=all&limit=50', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.meta?.state).toBe('queue_unavailable')
    expect(Array.isArray(json.data?.items)).toBe(true)
    expect(json.data.items).toHaveLength(0)
  })

  it('returns 403 when user is not a workspace member', async () => {
    getCurrentWorkspaceMock.mockResolvedValueOnce(mockWorkspace)
    getWorkspaceMembershipMock.mockResolvedValueOnce(null)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/workspace/actions/queue?status=all&limit=50', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('FORBIDDEN')
  })
})

