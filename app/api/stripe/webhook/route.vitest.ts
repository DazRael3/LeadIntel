import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const constructEventMock = vi.fn(() => ({}))
const retrieveSubscriptionMock = vi.fn(async () => ({}))
const userUpdateEqMock = vi.fn(async () => ({ error: null }))
const userUpdateMock = vi.fn(() => ({ eq: userUpdateEqMock }))
const userSelectEqMaybeSingleMock = vi.fn(async () => ({ data: { id: 'user_1' }, error: null }))
const userSelectMock = vi.fn(() => ({ eq: () => ({ maybeSingle: userSelectEqMaybeSingleMock }) }))
const subscriptionsUpsertMock = vi.fn(async () => ({ error: null }))
const lifecycleStateUpsertMock = vi.fn(async () => ({ error: null }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: constructEventMock,
    },
    subscriptions: {
      retrieve: retrieveSubscriptionMock,
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

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: userSelectMock,
          update: userUpdateMock,
        }
      }
      if (table === 'subscriptions') {
        return {
          upsert: subscriptionsUpsertMock,
        }
      }
      if (table === 'lifecycle_state') {
        return {
          upsert: lifecycleStateUpsertMock,
        }
      }
      if (table === 'workspaces') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
        upsert: async () => ({ error: null }),
      }
    },
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
    retrieveSubscriptionMock.mockImplementation(async () => ({
      id: 'sub_1',
      status: 'active',
      current_period_end: 1700003600,
      current_period_start: 1700000000,
      cancel_at_period_end: false,
      trial_end: null,
      items: { data: [{ price: { id: 'price_pro_123' } }] },
    }))
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
    process.env.STRIPE_PRICE_ID_PRO = 'price_pro_123'
    process.env.STRIPE_PRICE_ID = 'price_pro_123'
    process.env.STRIPE_PRICE_ID_CLOSER_PLUS = 'price_plus_123'
    process.env.STRIPE_PRICE_ID_TEAM = 'price_team_123'
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

  it('persists closer_plus subscription_tier from checkout completed', async () => {
    mockFeatureEnabled = true
    const eventPayload = {
      id: 'evt_plus',
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          customer: 'cus_plus',
          client_reference_id: 'user_1',
          subscription: 'sub_plus',
        },
      },
    }
    constructEventMock.mockImplementationOnce(() => eventPayload)
    retrieveSubscriptionMock.mockResolvedValueOnce({
      id: 'sub_plus',
      status: 'active',
      current_period_end: 1700003600,
      current_period_start: 1700000000,
      cancel_at_period_end: false,
      trial_end: null,
      items: { data: [{ price: { id: 'price_plus_123' } }] },
    })

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=123,v1=fake',
      },
      body: JSON.stringify(eventPayload),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(userUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_tier: 'closer_plus', stripe_customer_id: 'cus_plus' })
    )
  })

  it('persists team subscription_tier from customer.subscription.updated', async () => {
    mockFeatureEnabled = true
    const eventPayload = {
      id: 'evt_team',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_team',
          customer: 'cus_team',
          status: 'active',
          current_period_end: 1700003600,
          current_period_start: 1700000000,
          cancel_at_period_end: false,
          trial_end: null,
          items: { data: [{ price: { id: 'price_team_123' } }] },
        },
      },
    }
    constructEventMock.mockImplementationOnce(() => eventPayload)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=123,v1=fake',
      },
      body: JSON.stringify(eventPayload),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(userUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ subscription_tier: 'team' }))
  })

  it('downgrades to free when customer.subscription.updated is not active/trialing', async () => {
    mockFeatureEnabled = true
    const eventPayload = {
      id: 'evt_canceled',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_canceled',
          customer: 'cus_team',
          status: 'canceled',
          current_period_end: 1700003600,
          current_period_start: 1700000000,
          cancel_at_period_end: true,
          trial_end: null,
          items: { data: [{ price: { id: 'price_team_123' } }] },
        },
      },
    }
    constructEventMock.mockImplementationOnce(() => eventPayload)

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=123,v1=fake',
      },
      body: JSON.stringify(eventPayload),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(userUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ subscription_tier: 'free' }))
  })
})

