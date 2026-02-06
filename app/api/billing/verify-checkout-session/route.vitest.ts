import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

const adminUpdateEq = vi.fn(async () => ({ error: null }))
const adminUpsert = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table === 'users') {
        return { update: () => ({ eq: adminUpdateEq }) }
      }
      if (table === 'subscriptions') {
        return { upsert: adminUpsert }
      }
      return { update: () => ({ eq: adminUpdateEq }), upsert: adminUpsert }
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
    expect(adminUpsert).toHaveBeenCalled()
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

