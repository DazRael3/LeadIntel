import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }
let mockSubRow: { stripe_customer_id: string | null } | null = null
let stripeCreateImpl: (() => Promise<{ url: string }>) | null = null

class FakeSubsQuery {
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
    return Promise.resolve({
      data: mockSubRow ? [mockSubRow] : [],
      error: null,
    })
  }
}

vi.mock('@/lib/stripe', () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: vi.fn(async () => {
          if (stripeCreateImpl) return await stripeCreateImpl()
          return { url: 'https://billing.stripe.com/session_test' }
        }),
      },
    },
  },
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table !== 'subscriptions') throw new Error(`Unexpected table: ${table}`)
      return new FakeSubsQuery()
    },
  })),
}))

describe('/api/billing/portal', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    mockSubRow = null
    stripeCreateImpl = null
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('unauthenticated -> 401 { error: unauthorized }', async () => {
    mockAuthedUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/billing/portal', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toEqual({ error: 'unauthorized' })
  })

  it('authenticated with no subscription -> 200 { url: /pricing }', async () => {
    mockSubRow = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/billing/portal', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ url: '/pricing' })
  })

  it('authenticated with customer -> creates billing portal session and returns url', async () => {
    mockSubRow = { stripe_customer_id: 'cus_123' }
    const { stripe } = await import('@/lib/stripe')
    const createSpy = vi.mocked(stripe.billingPortal.sessions.create)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/billing/portal', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toContain('stripe')

    expect(createSpy).toHaveBeenCalledTimes(1)
    const args = createSpy.mock.calls[0]?.[0] as { customer?: string; return_url?: string }
    expect(args.customer).toBe('cus_123')
    expect(args.return_url).toMatch(/\/dashboard$/)
  })

  it('stripe throws -> 500 { error: billing_portal_failed }', async () => {
    mockSubRow = { stripe_customer_id: 'cus_123' }
    stripeCreateImpl = async () => {
      throw new Error('Stripe down')
    }

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/billing/portal', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json).toEqual({ error: 'billing_portal_failed' })
  })
})

