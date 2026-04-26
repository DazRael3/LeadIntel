import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockSubRow: unknown = null
let mockUserRow: unknown = null
let mockAuthedUser: { id: string; email?: string | null } | null = { id: 'user_1', email: 'user@example.com' }
let mockAuthEmail: string | null = 'user@example.com'
const mockAdminGetUserById = vi.fn(async (_id: string) => ({ data: { user: { email: mockAuthEmail } }, error: null }))

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
    auth: {
      admin: {
        getUserById: (id: string) => mockAdminGetUserById(id),
      },
    },
    from: (table: string) => new FakeQuery(table),
  })),
}))

describe('/api/plan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockSubRow = null
    mockUserRow = null
    mockAuthedUser = { id: 'user_1', email: 'user@example.com' }
    mockAuthEmail = 'user@example.com'

    // Minimal env to satisfy validation.
    process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123'
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123'
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-openai'

    process.env.ENABLE_APP_TRIAL = '0'
    process.env.STRIPE_PRICE_ID_PRO = 'price_pro_123'
    process.env.STRIPE_PRICE_ID = 'price_pro_123'
    process.env.STRIPE_PRICE_ID_CLOSER_PLUS = 'price_plus_123'
    process.env.STRIPE_PRICE_ID_TEAM = 'price_team_123'
    process.env.HOUSE_CLOSER_EMAILS = ''
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
    expect(json.data?.isHouseCloserOverride).toBe(false)
  })

  it('new user defaults to starter when free tier is explicitly persisted', async () => {
    mockUserRow = { subscription_tier: 'free' }
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/plan', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tier).toBe('starter')
    expect(json.data?.plan).toBe('free')
    expect(json.data?.planId).toBe(null)
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
    expect(json.data?.isHouseCloserOverride).toBe(false)
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
    expect(json.data?.isHouseCloserOverride).toBe(false)
  })

  it('active subscription with team price -> team tier, planId team', async () => {
    mockSubRow = { status: 'active', stripe_price_id: 'price_team_123' }
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/plan', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tier).toBe('team')
    expect(json.data?.planId).toBe('team')
    expect(json.data?.plan).toBe('pro')
    expect(json.data?.isHouseCloserOverride).toBe(false)
  })

  it('active subscription with closer_plus price -> closer_plus tier, planId closer_plus', async () => {
    mockSubRow = { status: 'active', stripe_price_id: 'price_plus_123' }
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/plan', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tier).toBe('closer_plus')
    expect(json.data?.planId).toBe('closer_plus')
    expect(json.data?.plan).toBe('pro')
    expect(json.data?.isHouseCloserOverride).toBe(false)
  })

  it('treats a house closer email as closer even without subscription', async () => {
    process.env.HOUSE_CLOSER_EMAILS = 'owner@dazrael.com'
    mockAuthedUser = { id: 'user_1', email: 'owner@dazrael.com' }
    mockAuthEmail = 'not-owner@example.com'
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/plan', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tier).toBe('closer')
    expect(json.data?.planId).toBe('pro')
    expect(json.data?.plan).toBe('pro')
    expect(json.data?.isHouseCloserOverride).toBe(true)
    expect(mockAdminGetUserById).not.toHaveBeenCalled()
  })

  it('treats a house closer email as closer via admin fallback when session email is missing', async () => {
    process.env.HOUSE_CLOSER_EMAILS = 'owner@dazrael.com'
    mockAuthedUser = { id: 'user_1', email: null }
    mockAuthEmail = 'owner@dazrael.com'
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/plan', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tier).toBe('closer')
    expect(json.data?.planId).toBe('pro')
    expect(json.data?.plan).toBe('pro')
    expect(json.data?.isHouseCloserOverride).toBe(true)
    expect(mockAdminGetUserById).toHaveBeenCalled()
  })
})

