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
    if (this.table === 'subscriptions') {
      return Promise.resolve({ data: mockExistingSubscription, error: null })
    }
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

let mockExistingSubscription: unknown = null

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
const createPortalSession = vi.fn(async () => ({ url: 'https://billing.stripe.com/test_portal' }))
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
    billingPortal: {
      sessions: {
        create: createPortalSession,
      },
    },
  },
}))

describe('/api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockExistingSubscription = null
    // Ensure env vars exist for route config checks.
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123'
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123'
    process.env.NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123'
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-openai'
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
    process.env.STRIPE_PRICE_ID_PRO = 'price_test_pro_123'
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

  it('POST returns 500 when Stripe price ID is missing for pro', async () => {
    // Ensure pro price id is missing (do not set STRIPE_PRICE_ID_PRO or STRIPE_PRICE_ID)
    delete process.env.STRIPE_PRICE_ID_PRO
    delete process.env.STRIPE_PRICE_ID

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro' }),
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('CHECKOUT_NOT_CONFIGURED')
    expect(String(json.error?.message || '')).toMatch(/missing stripe price id for plan: pro/i)
    expect(createSession).not.toHaveBeenCalled()
  })

  it('POST creates checkout session for Team (planId: team)', async () => {
    process.env.STRIPE_PRICE_ID_TEAM = 'price_test_team_123'
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: 'team' }),
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(typeof json.data?.url).toBe('string')

    expect(createSession).toHaveBeenCalledTimes(1)
    const arg = createSession.mock.calls[0]?.[0] as any
    expect(arg?.line_items?.[0]?.price).toBe(process.env.STRIPE_PRICE_ID_TEAM)
  })

  it('POST for Team returns billing portal url when already subscribed', async () => {
    mockExistingSubscription = { id: 'sub_1', status: 'active' }
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: 'team' }),
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.url).toBe('https://billing.stripe.com/test_portal')
    expect(createPortalSession).toHaveBeenCalledTimes(1)
    expect(createSession).not.toHaveBeenCalled()
  })

  it('POST returns 400 for unsupported planId', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: 'enterprise' }),
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('INVALID_CHECKOUT_PLAN')
  })
})

