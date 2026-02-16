import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }
let mockReportRow: unknown = { id: 'r1', report_date: '2026-01-01', generated_at: null, summary: 'ok', notes: null }

class FakeAdminQuery {
  select() {
    return this
  }
  order() {
    return this
  }
  limit() {
    return this
  }
  maybeSingle() {
    return Promise.resolve({ data: mockReportRow, error: null })
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: () => new FakeAdminQuery(),
  })),
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
  })),
}))

describe('/api/admin/site-report/latest', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    mockReportRow = { id: 'r1', report_date: '2026-01-01', generated_at: null, summary: 'ok', notes: null }
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    process.env.ADMIN_USER_ID = '123e4567-e89b-12d3-a456-426614174000' // must be UUID (env schema requirement)
  })

  it('unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/admin/site-report/latest', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('authenticated but not admin -> 403', async () => {
    mockAuthedUser = { id: 'user_1' }
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/admin/site-report/latest', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('admin -> returns latest report', async () => {
    mockAuthedUser = { id: '123e4567-e89b-12d3-a456-426614174000' }
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/admin/site-report/latest', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.report?.id).toBe('r1')
  })
})

