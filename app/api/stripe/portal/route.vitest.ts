import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }
let mockUserRow: { stripe_customer_id: string | null } | null = { stripe_customer_id: 'cus_123' }

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
  maybeSingle() {
    if (this.table === 'users') {
      return Promise.resolve({ data: mockUserRow, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }
}

vi.mock('@/lib/stripe', () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: vi.fn(async () => ({ url: 'https://stripe.test/portal' })),
      },
    },
  },
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
    from: (table: string) => new FakeQuery(table),
  })),
}))

describe('/api/stripe/portal', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    mockUserRow = { stripe_customer_id: 'cus_123' }
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/stripe/portal', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('UNAUTHORIZED')
  })

  it('authenticated -> returns billing portal url', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/stripe/portal', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.url).toContain('stripe')
  })
})

