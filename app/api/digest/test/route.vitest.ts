import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

describe('/api/digest/test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('is disabled in production (404)', async () => {
    vi.doMock('@/lib/runtimeFlags', async () => {
      const actual = await vi.importActual<typeof import('@/lib/runtimeFlags')>('@/lib/runtimeFlags')
      return { ...actual, isProduction: () => true }
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/digest/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('sends a test webhook in non-production when configured', async () => {
    vi.doMock('@/lib/runtimeFlags', async () => {
      const actual = await vi.importActual<typeof import('@/lib/runtimeFlags')>('@/lib/runtimeFlags')
      return { ...actual, isProduction: () => false }
    })

    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn(async () => ({ data: { digest_webhook_url: 'https://example.test/webhook' }, error: null })),
        }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(async () => ({ data: null, error: null })) }
    })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/digest/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

