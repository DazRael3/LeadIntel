import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { getUserSafe } from '@/lib/supabase/safe-auth'

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null })),
    },
  })),
}))

vi.mock('@/lib/billing/require-capability', () => ({
  requireCapability: vi.fn(),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(),
}))

const requireCapabilityMock = vi.mocked(requireCapability)
const getUserSafeMock = vi.mocked(getUserSafe)

describe('/api/history/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserSafeMock.mockResolvedValue({ email: 'user@example.com' } as any)
  })

  it('returns 403 when user lacks export capability', async () => {
    requireCapabilityMock.mockResolvedValue({ ok: false, tier: 'starter' })
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/history/export', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('allows export when user has export capability', async () => {
    requireCapabilityMock.mockResolvedValue({ ok: true, tier: 'closer' })

    const { createRouteClient } = await import('@/lib/supabase/route')
    const createRouteClientMock = vi.mocked(createRouteClient)
    createRouteClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null })),
      },
      from: (table: string) => {
        if (table === 'pitches') {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    {
                      created_at: '2026-01-01T00:00:00.000Z',
                      content: 'Draft message',
                      leads: {
                        company_name: 'Acme',
                        company_domain: 'acme.com',
                        company_url: 'https://acme.com',
                      },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }
        }

        return {
          select: () => ({
            eq: () => ({
              or: async () => ({ data: [], error: null }),
              in: async () => ({ data: [], error: null }),
            }),
          }),
        }
      },
    } as any)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/history/export', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    const body = await res.text()
    expect(body).toContain('created_at,company_name,company_domain,company_url,pitch')
    expect(body).toContain('Acme,acme.com,https://acme.com,Draft message')
  })
})

