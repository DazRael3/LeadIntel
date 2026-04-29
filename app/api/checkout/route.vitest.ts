import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type MockUser = { id: string; email: string } | null
type MockError = { code?: string; message?: string } | null
const BASE_URL = 'https://raelinfo.com'

let mockAuthUser: MockUser = { id: 'user_1', email: 'u@example.com' }
let mockStoredCustomerId: string | null = 'cus_123'
let mockExistingSubscription: unknown = null
let mockUserLookupError: MockError = null
let mockSubscriptionLookupError: MockError = null
const mockUserUpsert = vi.fn(async (_payload?: unknown) => ({ data: null, error: null }))
const mockAuthGetUser = vi.fn(async () => ({ data: { user: mockAuthUser }, error: null }))

class FakeQuery {
  private readonly table: string
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
  maybeSingle() {
    if (this.table === 'users') {
      const data = mockStoredCustomerId ? { stripe_customer_id: mockStoredCustomerId } : null
      return Promise.resolve({ data, error: mockUserLookupError })
    }
    if (this.table === 'subscriptions') {
      return Promise.resolve({ data: mockExistingSubscription, error: mockSubscriptionLookupError })
    }
    return Promise.resolve({ data: null, error: null })
  }
  upsert(payload: { stripe_customer_id?: string | null }) {
    if (typeof payload?.stripe_customer_id === 'string' && payload.stripe_customer_id.length > 0) {
      mockStoredCustomerId = payload.stripe_customer_id
    }
    return mockUserUpsert(payload)
  }
}

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: mockAuthGetUser,
    },
    from: (table: string) => new FakeQuery(table),
  })),
}))

const createCheckoutSession = vi.fn(async (_args: unknown) => ({ url: 'https://checkout.stripe.com/test_session' }))
const createCustomer = vi.fn(async () => ({ id: 'cus_new_123' }))
const retrievePrice = vi.fn(async (priceId: string) => ({
  id: priceId,
  type: 'recurring',
  active: true,
  recurring: { interval: 'month', interval_count: 1 },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: {
      create: createCustomer,
    },
    prices: {
      retrieve: retrievePrice,
    },
    checkout: {
      sessions: {
        create: createCheckoutSession,
      },
    },
  },
}))

describe('/api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockAuthUser = { id: 'user_1', email: 'u@example.com' }
    mockAuthGetUser.mockImplementation(async () => ({ data: { user: mockAuthUser }, error: null }))
    mockStoredCustomerId = 'cus_123'
    mockExistingSubscription = null
    mockUserLookupError = null
    mockSubscriptionLookupError = null
    mockAuthGetUser.mockReset()
    mockAuthGetUser.mockResolvedValue({ data: { user: mockAuthUser }, error: null })

    vi.stubEnv('NODE_ENV', 'test')
    process.env.NEXT_PUBLIC_APP_ENV = 'production'
    process.env.STRIPE_SECRET_KEY = 'sk_live_123'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://raelinfo.com'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.STRIPE_PRICE_ID_PRO = 'price_test_pro_123'
    process.env.STRIPE_PRICE_ID_CLOSER_PLUS = 'price_test_plus_123'
    process.env.STRIPE_PRICE_ID_TEAM = 'price_test_team_123'
  })

  it('returns 405 for GET', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(405)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('METHOD_NOT_ALLOWED')
  })

  it('returns INVALID_CHECKOUT_PAYLOAD when body is missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      body: '',
      headers: { 'Content-Type': 'application/json', origin: BASE_URL },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('INVALID_CHECKOUT_PAYLOAD')
  })

  it('creates Pro checkout successfully', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro', billingCycle: 'monthly' }),
      headers: { 'Content-Type': 'application/json', origin: BASE_URL },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    const args = createCheckoutSession.mock.calls[0]?.[0] as { line_items?: Array<{ price: string }>; success_url?: string }
    expect(args?.line_items?.[0]?.price).toBe('price_test_pro_123')
    expect(args?.success_url).toContain('/pricing/success?session_id={CHECKOUT_SESSION_ID}')
  })

  it('creates Pro+ checkout successfully', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planId: 'closer_plus', billingCycle: 'monthly' }),
      headers: { 'Content-Type': 'application/json', origin: BASE_URL },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    const args = createCheckoutSession.mock.calls[0]?.[0] as { line_items?: Array<{ price: string }> }
    expect(args?.line_items?.[0]?.price).toBe('price_test_plus_123')
  })

  it('creates Team checkout with seat quantity', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planId: 'team', billingCycle: 'monthly', seats: 7 }),
      headers: { 'Content-Type': 'application/json', origin: BASE_URL },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    const args = createCheckoutSession.mock.calls[0]?.[0] as { line_items?: Array<{ price: string; quantity: number }> }
    expect(args?.line_items?.[0]?.price).toBe('price_test_team_123')
    expect(args?.line_items?.[0]?.quantity).toBe(7)
  })

  it('returns AUTH_REQUIRED when user is not authenticated', async () => {
    mockAuthUser = null
    mockAuthGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const { POST } = await import('./route')
    const req = new NextRequest(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro' }),
      headers: { 'Content-Type': 'application/json', origin: BASE_URL },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('AUTH_REQUIRED')
  })

  it('returns UNSUPPORTED_PLAN for unknown plan ids', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planId: 'enterprise' }),
      headers: { 'Content-Type': 'application/json', origin: BASE_URL },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('UNSUPPORTED_PLAN')
  })

  it('returns CHECKOUT_CONFIG_MISSING when pro price id is missing', async () => {
    delete process.env.STRIPE_PRICE_ID_PRO
    delete process.env.STRIPE_PRICE_ID

    const { POST } = await import('./route')
    const req = new NextRequest(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro' }),
      headers: { 'Content-Type': 'application/json', origin: BASE_URL },
    })
    const res = await POST(req)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('CHECKOUT_CONFIG_MISSING')
    expect(createCheckoutSession).not.toHaveBeenCalled()
  })

  it('retries with new customer when stored customer is stale and succeeds', async () => {
    mockStoredCustomerId = 'cus_bad'
    createCheckoutSession
      .mockRejectedValueOnce(new Error('No such customer: cus_bad'))
      .mockResolvedValueOnce({ url: 'https://checkout.stripe.com/retried' })
    createCustomer.mockResolvedValueOnce({ id: 'cus_repaired_123' })

    const { POST } = await import('./route')
    const req = new NextRequest(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro' }),
      headers: { 'Content-Type': 'application/json', origin: BASE_URL },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(createCheckoutSession).toHaveBeenCalledTimes(2)
    const first = createCheckoutSession.mock.calls[0]?.[0] as { customer?: string }
    const second = createCheckoutSession.mock.calls[1]?.[0] as { customer?: string }
    expect(first.customer).toBe('cus_bad')
    expect(second.customer).toBe('cus_repaired_123')
    expect(mockUserUpsert).toHaveBeenCalled()
  })

  it('returns safe CHECKOUT_SESSION_CREATE_FAILED when stale-customer retry fails', async () => {
    mockStoredCustomerId = 'cus_bad'
    createCheckoutSession
      .mockRejectedValueOnce(new Error('No such customer: cus_bad'))
      .mockRejectedValueOnce(new Error('No such customer: cus_retry_bad'))
    createCustomer.mockResolvedValueOnce({ id: 'cus_retry_new' })

    const { POST } = await import('./route')
    const req = new NextRequest(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planId: 'pro' }),
      headers: { 'Content-Type': 'application/json', origin: BASE_URL },
    })
    const res = await POST(req)
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('CHECKOUT_SESSION_CREATE_FAILED')
    expect(String(json.error?.message ?? '')).toMatch(/temporarily unavailable/i)
    expect(String(JSON.stringify(json))).not.toContain('cus_bad')
    expect(String(JSON.stringify(json))).not.toContain('cus_retry_bad')
    expect(res.status).not.toBe(500)
  })

  it('includes requestId in checkout error responses', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planId: 'enterprise' }),
      headers: { 'Content-Type': 'application/json', origin: BASE_URL },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(typeof json.error?.requestId).toBe('string')
    expect((json.error?.requestId as string).length).toBeGreaterThan(0)
  })
})
