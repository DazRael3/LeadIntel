import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }
let mockPlan: { plan: 'free' | 'pro' } = { plan: 'pro' }
let mockPitchRows: Array<{
  id: string
  lead_id: string
  content: string
  created_at: string
  leads?: { company_name?: string | null; company_domain?: string | null; company_url?: string | null } | null
}> = []

class FakeQuery {
  private table: string
  constructor(table: string) {
    this.table = table
  }
  select() {
    return this
  }
  eq() {
    return this
  }
  order() {
    return this
  }
  limit() {
    return this
  }
  lt() {
    return this
  }
  or() {
    return this
  }
  in() {
    return this
  }

  // Allow `await query` for the pitches query builder
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ) {
    const value = this.table === 'pitches' ? { data: mockPitchRows, error: null } : { data: null, error: null }
    return Promise.resolve(value).then(onfulfilled as never, onrejected as never)
  }
}

vi.mock('@/lib/billing/plan', () => ({
  getPlanDetails: vi.fn(async () => mockPlan),
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
    from: (table: string) => new FakeQuery(table),
  })),
}))

describe('/api/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    mockPlan = { plan: 'pro' }
    mockPitchRows = [
      {
        id: 'pitch_1',
        lead_id: 'lead_1',
        content: 'Hello',
        created_at: new Date().toISOString(),
        leads: { company_name: 'Acme', company_domain: 'acme.com', company_url: 'https://acme.com' },
      },
    ]
  })

  it('unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/history', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('UNAUTHORIZED')
  })

  it('authenticated but free plan -> 403', async () => {
    mockPlan = { plan: 'free' }
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/history', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('FORBIDDEN')
  })

  it('authenticated pro -> returns items', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/history', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(Array.isArray(json.data?.items)).toBe(true)
    expect(json.data.items).toHaveLength(1)
  })
})

