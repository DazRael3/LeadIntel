import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(() => ({})),
    },
    subscriptions: {
      retrieve: vi.fn(async () => ({})),
    },
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
      upsert: async () => ({ error: null }),
    }),
  })),
}))

let mockFeatureEnabled = false
vi.mock('@/lib/services/feature-flags', () => ({
  isFeatureEnabled: vi.fn(async () => mockFeatureEnabled),
}))

describe('/api/stripe/webhook', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockFeatureEnabled = false
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('acknowledges when webhook feature is disabled', async () => {
    const { POST } = await import('./route')
    const event = { id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } }
    const req = new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=123,v1=fake',
      },
      body: JSON.stringify(event),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.received).toBe(true)
    expect(json.data?.disabled).toBe(true)
  })
})

