import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockSubRow: unknown = null
let mockUserRow: unknown = null
let mockAuthedUser: { id: string } | null = { id: 'user_1' }

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
  then(onfulfilled: (v: any) => any, onrejected?: (e: unknown) => any) {
    // Promise-like support for awaiting `.limit(1)` without `.maybeSingle()`
    const exec = async () => {
      if (this.table === 'subscriptions') {
        const rows = mockSubRow ? [mockSubRow] : []
        return { data: rows, error: null }
      }
      return { data: [], error: null }
    }
    return exec().then(onfulfilled, onrejected)
  }
  maybeSingle() {
    if (this.table === 'subscriptions') {
      // Some callers still use maybeSingle in other paths.
      return Promise.resolve({ data: mockSubRow, error: null })
    }
    if (this.table === 'users') {
      return Promise.resolve({ data: mockUserRow, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }
  schema() {
    return this
  }
}

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
    schema: () => ({
      from: (table: string) => new FakeQuery(table),
    }),
    from: (table: string) => new FakeQuery(table),
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => new FakeQuery(table),
  })),
}))

describe('/api/plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubRow = null
    mockUserRow = null
    mockAuthedUser = { id: 'user_1' }
    process.env.ENABLE_APP_TRIAL = '0'
    process.env.STRIPE_PRICE_ID_PRO = 'price_pro_123'
    process.env.STRIPE_PRICE_ID = 'price_pro_123'
    process.env.STRIPE_PRICE_ID_TEAM = 'price_team_123'
  })

  it('unauthenticated request -> returns starter/free plan (200)', async () => {
    mockAuthedUser = null
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/plan', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('UNAUTHORIZED')
    expect(json.error?.message).toBe('Authentication required')
  })

  it('user with no subscription row -> starter, planId null, plan free', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/plan', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tier).toBe('starter')
    expect(json.data?.planId).toBe(null)
    expect(json.data?.plan).toBe('free')
  })

  it('user row marked pro but no subscription row -> closer tier, planId pro', async () => {
    mockUserRow = { subscription_tier: 'pro' }
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/plan', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tier).toBe('closer')
    expect(json.data?.planId).toBe('pro')
    expect(json.data?.plan).toBe('pro')
  })

  it('active subscription with closer price -> closer tier, planId pro', async () => {
    mockSubRow = { status: 'active', stripe_price_id: 'price_pro_123' }
    mockUserRow = { subscription_tier: 'free' }
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/plan', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tier).toBe('closer')
    expect(json.data?.planId).toBe('pro')
    expect(json.data?.plan).toBe('pro')
  })

  it('active subscription with non-closer price -> still treated as closer tier (legacy team -> closer)', async () => {
    mockSubRow = { status: 'active', stripe_price_id: 'price_team_123' }
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/plan', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tier).toBe('closer')
    expect(json.data?.planId).toBe('pro')
    expect(json.data?.plan).toBe('pro')
  })
})

