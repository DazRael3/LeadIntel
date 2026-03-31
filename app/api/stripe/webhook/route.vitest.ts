import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const constructEventMock = vi.fn(() => ({}))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: constructEventMock,
    },
    subscriptions: {
      retrieve: vi.fn(async () => ({})),
    },
  },
}))

let shouldProcessResult: 'first' | 'duplicate' | 'throw_unavailable' = 'first'
vi.mock('@/lib/webhooks/stripe-idempotency', () => ({
  recordStripeWebhookEventIfFirst: vi.fn(async () => {
    if (shouldProcessResult === 'throw_unavailable') {
      const err = new Error('Stripe webhook idempotency unavailable')
      err.name = 'StripeIdempotencyUnavailable'
      throw err
    }
    return shouldProcessResult
  }),
}))

vi.mock('@/lib/services/analytics', () => ({
  logProductEvent: vi.fn(async () => {}),
}))

vi.mock('@/lib/audit/log', () => ({
  logAudit: vi.fn(async () => {}),
}))

vi.mock('@/lib/integrations/webhooks', () => ({
  enqueueWebhookEvent: vi.fn(async () => {}),
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
    shouldProcessResult = 'first'
    constructEventMock.mockImplementation(() => ({}))
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

  it('rejects invalid signature (sanitized)', async () => {
    mockFeatureEnabled = true
    constructEventMock.mockImplementationOnce(() => {
      throw new Error('bad signature details should not leak')
    })

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
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(String(json.error?.message ?? '')).toMatch(/Invalid webhook signature/i)
    expect(String(json.error?.details ?? '')).not.toContain('bad signature details')
  })

  it('acks duplicates safely without processing', async () => {
    mockFeatureEnabled = true
    shouldProcessResult = 'duplicate'
    constructEventMock.mockImplementationOnce(() => ({ id: 'evt_dupe', type: 'checkout.session.completed', data: { object: {} } }))

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=123,v1=fake',
      },
      body: JSON.stringify({ id: 'evt_dupe', type: 'checkout.session.completed', data: { object: {} } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.duplicate).toBe(true)
  })

  it('fails closed when idempotency storage is unavailable', async () => {
    mockFeatureEnabled = true
    // Simulate missing table / schema issues: idempotency layer must NOT fail-open.
    shouldProcessResult = 'throw_unavailable'
    constructEventMock.mockImplementationOnce(() => ({ id: 'evt_missing', type: 'checkout.session.completed', data: { object: {} } }))

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=123,v1=fake',
      },
      body: JSON.stringify({ id: 'evt_missing', type: 'checkout.session.completed', data: { object: {} } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(String(json.error?.message ?? '')).toMatch(/Idempotency storage unavailable/i)
  })
})

