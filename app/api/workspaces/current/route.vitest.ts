import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type User = { id: string; email?: string }

const mockUser: User = { id: 'user_1', email: 'u1@example.com' }

const ensurePersonalWorkspace = vi.fn(async () => ({ id: 'ws_1', name: 'Workspace', owner_user_id: 'user_1', default_template_set_id: null, created_at: new Date().toISOString() }))
const getCurrentWorkspace = vi.fn(async () => null)
const getWorkspaceMembership = vi.fn(async () => ({ role: 'owner' as const }))

vi.mock('@/lib/api/guard', () => ({
  withApiGuard: (handler: any) => {
    return (req: NextRequest) => handler(req, { requestId: 'req_1', userId: mockUser.id })
  },
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => mockUser),
}))

vi.mock('@/lib/team/workspace', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking module boundary for route tests
  ensurePersonalWorkspace: (...args: any[]) => ensurePersonalWorkspace(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking module boundary for route tests
  getCurrentWorkspace: (...args: any[]) => getCurrentWorkspace(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mocking module boundary for route tests
  getWorkspaceMembership: (...args: any[]) => getWorkspaceMembership(...args),
}))

describe('/api/workspaces/current', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCurrentWorkspace.mockResolvedValue(null)
    ensurePersonalWorkspace.mockResolvedValue({
      id: 'ws_1',
      name: 'Workspace',
      owner_user_id: mockUser.id,
      default_template_set_id: null,
      created_at: new Date().toISOString(),
    })
    getWorkspaceMembership.mockResolvedValue({ role: 'owner' })
  })

  it('returns ok:true with state=ready when workspace resolves', async () => {
    getCurrentWorkspace.mockResolvedValueOnce({
      id: 'ws_1',
      name: 'Workspace',
      owner_user_id: mockUser.id,
      default_template_set_id: null,
      created_at: new Date().toISOString(),
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/workspaces/current', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.state).toBe('ready')
    expect(json.data.workspace).toMatchObject({ id: 'ws_1' })
  })

  it('returns ok:true with workspace=null when bootstrap is temporarily unavailable', async () => {
    ensurePersonalWorkspace.mockRejectedValueOnce(new Error('Failed to create workspace'))
    getCurrentWorkspace.mockResolvedValue(null)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/workspaces/current', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.workspace).toBe(null)
    expect(json.data.state).toBe('bootstrap_unavailable')
  })
})

