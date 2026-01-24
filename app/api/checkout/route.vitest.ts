import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

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
  in() {
    return this
  }
  order() {
    return this
  }
  limit() {
    return this
  }
  single() {
    if (this.table === 'users') {
      return Promise.resolve({ data: { stripe_customer_id: 'cus_123' }, error: null })
    }
    // subscriptions: no active subscription in tests
    return Promise.resolve({ data: null, error: null })
  }
  maybeSingle() {
    // subscriptions lookup in plan helpers
    return Promise.resolve({ data: null, error: null })
  }
  upsert() {
    return Promise.resolve({ data: null, error: null })
  }
  update() {
    return this
  }
  delete() {
    return this
  }
}

// Minimal Supabase route client mock (auth + db stubs).
vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1', email: 'u@example.com' } }, error: null })),
    },
    from: (table: string) => new FakeQuery(table),
  })),
}))

// Stripe mock: ensure we can assert server-side mapping of price ids.
const createSession = vi.fn(async (_args: unknown) => ({ url: 'https://checkout.stripe.com/test_session' }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: {
      create: vi.fn(async () => ({ id: 'cus_123' })),
    },
    checkout: {
      sessions: {
        create: createSession,
      },
    },
  },
}))

describe('/api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure env vars exist for route config checks.
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123'
    process.env.STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO || 'price_test_pro_123'
    process.env.STRIPE_TRIAL_FEE_PRICE_ID = process.env.STRIPE_TRIAL_FEE_PRICE_ID || 'price_test_trial_25'
    process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123'
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
  })

  it('GET returns 405 METHOD_NOT_ALLOWED JSON', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/checkout', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(405)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('METHOD_NOT_ALLOWED')
  })

  it('POST with missing body returns INVALID_CHECKOUT_PAYLOAD', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      body: '',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('INVALID_CHECKOUT_PAYLOAD')
  })

  it('POST ignores client-provided priceId and uses server plan mapping', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro', priceId: 'price_evil_override' }),
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(typeof json.data?.url).toBe('string')

    // Assert Stripe session creation used the server env price id, not the client provided one.
    expect(createSession).toHaveBeenCalledTimes(1)
    const arg = createSession.mock.calls[0]?.[0] as any
    expect(arg?.line_items?.[0]?.price).toBe(process.env.STRIPE_PRICE_ID_PRO)
  })
})

