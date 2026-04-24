import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()

type DbState = {
  api: {
    users: Map<string, { subscription_tier?: string | null }>
    subscriptions: Map<string, { user_id: string; status: string; stripe_price_id: string | null }>
  }
}

let db: DbState = {
  api: {
    users: new Map(),
    subscriptions: new Map(),
  },
}

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    schema: () => ({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => {
                  if (table === 'subscriptions') {
                    const row = db.api.subscriptions.get('latest') ?? null
                    return { data: row, error: null }
                  }
                  if (table === 'users') {
                    const row = db.api.users.get('user_1') ?? null
                    return { data: row, error: null }
                  }
                  return { data: null, error: null }
                },
              }),
            }),
            maybeSingle: async () => {
              if (table === 'users') {
                const row = db.api.users.get('user_1') ?? null
                return { data: row, error: null }
              }
              return { data: null, error: null }
            },
          }),
        }),
      }),
    }),
  })),
}))

const adminUpdateEq = vi.fn(async () => ({ error: null }))
const adminUpdate = vi.fn((payload: { subscription_tier?: string }) => ({
  eq: async (_col: string, id: string) => {
    db.api.users.set(id, { ...(db.api.users.get(id) ?? {}), ...payload })
    return adminUpdateEq()
  },
}))
const adminUpsert = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: (_opts?: { schema?: string }) => ({
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: db.api.users.get(id) ?? null, error: null }),
            }),
            // If someone calls maybeSingle() without eq() (not expected), return null.
            maybeSingle: async () => ({ data: null, error: null }),
          }),
          update: adminUpdate,
        }
      }
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  then: (onfulfilled: (v: any) => any, onrejected?: (e: unknown) => any) => {
                    const rows = db.api.subscriptions.get('latest') ? [db.api.subscriptions.get('latest')] : []
                    return Promise.resolve({ data: rows, error: null }).then(onfulfilled, onrejected)
                  },
                }),
              }),
            }),
            // If awaited directly without eq/order (not expected), return empty rows.
            then: (onfulfilled: (v: any) => any, onrejected?: (e: unknown) => any) =>
              Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected),
          }),
          upsert: async (payload: { user_id: string; status: string; stripe_price_id: string | null }) => {
            db.api.subscriptions.set('latest', payload)
            return adminUpsert()
          },
        }
      }
      return {}
    },
  }),
}))

const retrieve = vi.fn()
const listLineItems = vi.fn()
vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve,
        listLineItems,
      },
    },
  },
}))

describe('/api/billing/verify-checkout-session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    db = { api: { users: new Map(), subscriptions: new Map() } }

    // Minimal env to satisfy validation.
    process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123'
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123'
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-openai'
    process.env.STRIPE_PRICE_ID_PRO = 'price_test_pro_123'

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user_1', email: 'u@example.com' } }, error: null })
  })

  it('verifies a paid session and upserts subscription', async () => {
    retrieve.mockResolvedValue({
      id: 'cs_test_123',
      client_reference_id: 'user_1',
      metadata: { user_id: 'user_1' },
      payment_status: 'paid',
      status: 'complete',
      customer: 'cus_123',
      subscription: {
        id: 'sub_123',
        status: 'active',
        current_period_start: 1700000000,
        current_period_end: 1700003600,
        cancel_at_period_end: false,
        trial_end: null,
        items: { data: [{ price: { id: 'price_test_pro_123' } }] },
      },
    })

    listLineItems.mockResolvedValue({
      data: [{ price: { id: 'price_test_pro_123' } }],
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/billing/verify-checkout-session?session_id=cs_test_123', {
      method: 'GET',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.verified).toBe(true)
    expect(json.data?.plan).toBe('pro')
    expect(adminUpdateEq).toHaveBeenCalled()
    expect(adminUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_tier: 'pro' }))
    expect(adminUpsert).toHaveBeenCalled()
  })

  it('persists closer_plus subscription tier when Stripe price maps to closer_plus', async () => {
    process.env.STRIPE_PRICE_ID_CLOSER_PLUS = 'price_plus_123'
    retrieve.mockResolvedValue({
      id: 'cs_test_plus',
      client_reference_id: 'user_1',
      metadata: { user_id: 'user_1' },
      payment_status: 'paid',
      status: 'complete',
      customer: 'cus_123',
      subscription: {
        id: 'sub_plus',
        status: 'active',
        current_period_start: 1700000000,
        current_period_end: 1700003600,
        cancel_at_period_end: false,
        trial_end: null,
        items: { data: [{ price: { id: 'price_plus_123' } }] },
      },
    })
    listLineItems.mockResolvedValue({
      data: [{ price: { id: 'price_plus_123' } }],
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/billing/verify-checkout-session?session_id=cs_test_plus', {
      method: 'GET',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(adminUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_tier: 'closer_plus' }))
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.plan).toBe('pro')
  })

  it('returns agency product plan when Stripe price maps to team', async () => {
    process.env.STRIPE_PRICE_ID_TEAM = 'price_team_123'
    retrieve.mockResolvedValue({
      id: 'cs_test_team',
      client_reference_id: 'user_1',
      metadata: { user_id: 'user_1' },
      payment_status: 'paid',
      status: 'complete',
      customer: 'cus_123',
      subscription: {
        id: 'sub_team',
        status: 'active',
        current_period_start: 1700000000,
        current_period_end: 1700003600,
        cancel_at_period_end: false,
        trial_end: null,
        items: { data: [{ price: { id: 'price_team_123' } }] },
      },
    })
    listLineItems.mockResolvedValue({
      data: [{ price: { id: 'price_team_123' } }],
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/billing/verify-checkout-session?session_id=cs_test_team', {
      method: 'GET',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.verified).toBe(true)
    expect(json.data?.tier).toBe('team')
    expect(json.data?.planId).toBe('team')
    expect(json.data?.plan).toBe('agency')
    expect(adminUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_tier: 'team' }))
  })

  it('persists to api schema so /api/plan resolves closer immediately', async () => {
    retrieve.mockResolvedValue({
      id: 'cs_test_123',
      client_reference_id: 'user_1',
      metadata: { user_id: 'user_1' },
      payment_status: 'paid',
      status: 'complete',
      customer: 'cus_123',
      subscription: {
        id: 'sub_123',
        status: 'active',
        current_period_start: 1700000000,
        current_period_end: 1700003600,
        cancel_at_period_end: false,
        trial_end: null,
        items: { data: [{ price: { id: 'price_test_pro_123' } }] },
      },
    })
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_test_pro_123' } }] })

    const { GET: verify } = await import('./route')
    const verifyReq = new NextRequest(
      'http://localhost:3000/api/billing/verify-checkout-session?session_id=cs_test_123',
      { method: 'GET' }
    )
    const verifyRes = await verify(verifyReq)
    expect(verifyRes.status).toBe(200)
    const verifyJson = await verifyRes.json()
    expect(verifyJson.ok).toBe(true)
    expect(verifyJson.data?.tier).toBe('closer')
    expect(db.api.users.get('user_1')?.subscription_tier).toBe('pro')
    expect(db.api.subscriptions.get('latest')?.status).toBe('active')

    const { GET: plan } = await import('@/app/api/plan/route')
    const planReq = new NextRequest('http://localhost:3000/api/plan', { method: 'GET' })
    const planRes = await plan(planReq)
    expect(planRes.status).toBe(200)
    const planJson = await planRes.json()
    expect(planJson.ok).toBe(true)
    expect(planJson.data?.tier).toBe('closer')
    expect(planJson.data?.planId).toBe('pro')
  })

  it('returns 403 when the session belongs to a different user', async () => {
    retrieve.mockResolvedValue({
      id: 'cs_test_123',
      client_reference_id: 'someone_else',
      metadata: {},
      payment_status: 'paid',
      status: 'complete',
      customer: 'cus_123',
      subscription: 'sub_123',
    })
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_test_pro_123' } }] })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/billing/verify-checkout-session?session_id=cs_test_123', {
      method: 'GET',
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(adminUpdateEq).not.toHaveBeenCalled()
    expect(adminUpsert).not.toHaveBeenCalled()
  })
})

