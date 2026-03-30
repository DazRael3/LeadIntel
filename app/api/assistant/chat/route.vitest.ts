import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type User = { id: string; email?: string }
const mockUser: User = { id: 'user_1', email: 'u1@example.com' }

vi.mock('@/lib/api/guard', () => ({
  withApiGuard: (handler: (req: NextRequest, ctx: { requestId: string; userId: string | null; body?: unknown }) => Promise<Response> | Response) => {
    return (req: NextRequest) => handler(req, { requestId: 'req_1', userId: mockUser.id, body: {} })
  },
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => mockUser),
}))

vi.mock('@/lib/billing/require-capability', () => ({
  requireCapability: vi.fn(async () => ({ ok: false, tier: 'starter' })),
}))

describe('/api/assistant/chat', () => {
  it('returns structured 403 when plan required (no retries expected from client)', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/assistant/chat', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('ASSISTANT_PLAN_REQUIRED')
  })
})

