import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

let mockGuardUserId: string | undefined = 'user_1'
let mockUser: { id: string; email?: string | null } | null = { id: 'user_1', email: 'demo@example.com' }
let mockClaimedLeadId: string | undefined
const clearDemoCookieMock = vi.fn()
const claimDemoHandoffFromRequestMock = vi.fn(async () => ({
  ...(mockClaimedLeadId ? { claimedLeadId: mockClaimedLeadId } : {}),
}))

vi.mock('@/lib/api/guard', () => ({
  withApiGuard:
    (
      handler: (
        req: NextRequest,
        ctx: { requestId: string; userId?: string }
      ) => Promise<Response> | Response
    ) =>
    (req: NextRequest) =>
      handler(req, { requestId: 'req_1', userId: mockGuardUserId }),
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => mockUser),
}))

vi.mock('@/lib/demo/claim', () => ({
  claimDemoHandoffFromRequest: claimDemoHandoffFromRequestMock,
  clearDemoHandoffCookieOnResponse: clearDemoCookieMock,
}))

describe('/api/demo/claim', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGuardUserId = 'user_1'
    mockUser = { id: 'user_1', email: 'demo@example.com' }
    mockClaimedLeadId = undefined
  })

  it('returns 401 when guard context has no user id', async () => {
    mockGuardUserId = undefined
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/demo/claim', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when auth user is missing', async () => {
    mockUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/demo/claim', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns claimed=true when handoff claim succeeds', async () => {
    mockClaimedLeadId = 'lead_1'
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/demo/claim', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.claimed).toBe(true)
    expect(json.data?.claimedLeadId).toBe('lead_1')
    expect(clearDemoCookieMock).toHaveBeenCalledOnce()
  })

  it('returns claimed=false when no demo session exists', async () => {
    mockClaimedLeadId = undefined
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/demo/claim', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.claimed).toBe(false)
  })

  it('surfaces 500 when claim call throws', async () => {
    claimDemoHandoffFromRequestMock.mockRejectedValueOnce(new Error('claim failed'))
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/demo/claim', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
