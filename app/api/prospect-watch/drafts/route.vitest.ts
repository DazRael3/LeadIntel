import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type User = { id: string; email?: string }
const mockUser: User = { id: 'user_1', email: 'u1@example.com' }

const getCurrentWorkspace = vi.fn(async () => ({ id: 'ws_1' }))
const getWorkspaceMembership = vi.fn(async () => ({ role: 'owner' }))

vi.mock('@/lib/api/guard', () => ({
  withApiGuard: (handler: (req: NextRequest, ctx: { requestId: string; body?: unknown }) => Promise<Response> | Response) => {
    return (req: NextRequest) => handler(req, { requestId: 'req_1', body: { id: '11111111-1111-1111-1111-111111111111', sendReady: true } })
  },
}))

const logOutboundEvent = vi.fn(async (_args: unknown) => undefined)
vi.mock('@/lib/outbound/events', () => ({
  logOutboundEvent: (args: unknown) => logOutboundEvent(args),
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockUser }, error: null })),
    },
    schema: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === 'prospect_watch_outreach_drafts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: { contact_id: null }, error: null })),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: null })),
              })),
            })),
          }
        }
        if (table === 'prospect_watch_contacts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            })),
          }
        }
        throw new Error(`unexpected table: ${table}`)
      }),
    })),
  })),
}))

vi.mock('@/lib/team/gating', () => ({
  requireTeamPlan: vi.fn(async () => ({ ok: true })),
}))

vi.mock('@/lib/team/workspace', () => ({
  getCurrentWorkspace,
  getWorkspaceMembership,
}))

describe('/api/prospect-watch/drafts', () => {
  it('rejects sendReady when no contact selected', async () => {
    const { PATCH } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/prospect-watch/drafts', { method: 'PATCH' })
    const res = await PATCH(req)
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(json.error.details).toMatchObject({ reason: 'contact_required' })
  })
})

