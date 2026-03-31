import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type User = { id: string; email?: string }
const mockUser: User = { id: 'user_1', email: 'u1@example.com' }

const getCurrentWorkspace = vi.fn(async () => null)
const getWorkspaceMembership = vi.fn(async () => null)

vi.mock('@/lib/api/guard', () => ({
  withApiGuard: (handler: (req: NextRequest, ctx: { requestId: string }) => Promise<Response> | Response) => {
    return (req: NextRequest) => handler(req, { requestId: 'req_1' })
  },
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser }, error: null })),
    },
    schema: vi.fn(() => ({
      from: vi.fn(() => {
        throw new Error('should_not_query_db_without_workspace')
      }),
    })),
  })),
}))

vi.mock('@/lib/team/gating', () => ({
  requireTeamPlan: vi.fn(async () => ({ ok: true, tier: 'team' })),
  getUserTierForGating: vi.fn(async () => 'team'),
}))

vi.mock('@/lib/team/workspace', () => ({
  getCurrentWorkspace,
  getWorkspaceMembership,
}))

describe('/api/prospect-watch/queue', () => {
  it('returns ok:true with empty items when workspace is missing (prospects)', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/prospect-watch/queue?kind=prospects', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.workspaceId).toBe(null)
    expect(Array.isArray(json.data.items)).toBe(true)
    expect(json.data.items.length).toBe(0)
    expect(json.data.reason).toBe('workspace_missing')
  })

  it('returns ok:true with empty items when workspace is missing (content)', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/prospect-watch/queue?kind=content', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.workspaceId).toBe(null)
    expect(Array.isArray(json.data.items)).toBe(true)
    expect(json.data.items.length).toBe(0)
    expect(json.data.reason).toBe('workspace_missing')
  })
})

