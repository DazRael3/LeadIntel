import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { STARTER_PITCH_CAP_LIMIT } from '@/lib/billing/constants'

let mockIsPro = false

vi.mock('@/lib/billing/plan', () => ({
  isPro: vi.fn(async () => mockIsPro),
}))

vi.mock('@/lib/services/triggerEvents', () => ({
  ingestRealTriggerEvents: vi.fn(async () => ({ created: 0 })),
  seedDemoTriggerEventsIfEmpty: vi.fn(async () => ({ created: 2 })),
  hasAnyTriggerEvents: vi.fn(async () => true),
  getLatestTriggerEvent: vi.fn(async () => ({ id: 'event_1' })),
}))

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
  order() {
    return this
  }
  limit() {
    return this
  }
  single() {
    if (this.table === 'users') {
      return Promise.resolve({ data: { subscription_tier: 'pro' }, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }
  maybeSingle() {
    if (this.table === 'user_settings') {
      return Promise.resolve({ data: { what_you_sell: 'Widgets', ideal_customer: 'B2B teams' }, error: null })
    }
    if (this.table === 'subscriptions') {
      return Promise.resolve({ data: mockSubscriptionRow, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }
}

let mockSubscriptionRow: any = null

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1', email: 'user@example.com' } }, error: null })),
    },
    schema: () => ({
      from: (table: string) => new FakeQuery(table),
    }),
    from: (table: string) => new FakeQuery(table),
  })),
}))

vi.mock('@/lib/supabase/schema-client', () => ({
  queryWithSchemaFallback: vi.fn(async (_request: unknown, _bridge: unknown, fn: any) => {
    // Execute callback with a minimal client so route logic stays close to reality.
    const client = {
      from: (table: string) => ({
        upsert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'lead_1' }, error: null }),
          }),
        }),
        insert: () => {
          // leads insert returns the created row (id) via select().single()
          if (table === 'leads') {
            return {
              select: () => ({
                single: async () => ({ data: { id: 'lead_1' }, error: null }),
              }),
            }
          }
          // pitches insert returns { error } (no select used in route)
          if (table === 'pitches') {
            return Promise.resolve({ error: null })
          }
          return Promise.resolve({ error: null })
        },
      }),
    }
    return await fn(client)
  }),
}))

vi.mock('@/lib/ai-logic', () => ({
  generatePitch: vi.fn(async () => 'Mock pitch text'),
  generateBattleCard: vi.fn(async () => ({ currentTech: ['A'], painPoint: 'B', killerFeature: 'C' })),
  generateEmailSequence: vi.fn(async () => ({ part1: 'P1', part2: 'P2', part3: 'P3' })),
}))

vi.mock('@/lib/billing/usage', () => ({
  checkStarterPitchUsage: vi.fn(async () => ({ ok: true, remaining: 999, limit: 20 })),
  getStarterLeadCountFromDb: vi.fn(async () => 0),
  getStarterPitchCapSummary: vi.fn(async () => ({ used: 0, limit: STARTER_PITCH_CAP_LIMIT })),
  recordStarterPitchCapUsage: vi.fn(async () => ({ used: 1, limit: 3 })),
}))

describe('/api/generate-pitch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENABLE_DEMO_TRIGGER_EVENTS = 'true'
    mockSubscriptionRow = null
    mockIsPro = false
  })

  it('starter user under limit can generate pitch', async () => {
    const { POST } = await import('./route')
    const { checkStarterPitchUsage } = await import('@/lib/billing/usage')

    const req = new NextRequest('http://localhost:3000/api/generate-pitch', {
      method: 'POST',
      body: JSON.stringify({ companyUrl: 'dell.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(typeof json.data?.pitch).toBe('string')
    expect(json.data.pitch).toBe('Mock pitch text')
    expect(checkStarterPitchUsage).toHaveBeenCalledTimes(1)
  })

  it('name-only input persists lead + pitch (no missing lead id warning)', async () => {
    const { POST } = await import('./route')

    const req = new NextRequest('http://localhost:3000/api/generate-pitch', {
      method: 'POST',
      body: JSON.stringify({ companyUrl: 'Redpath' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    // lead should be returned by the mocked insert/select().single()
    expect(json.data?.lead).toBeTruthy()
    // and warnings should not include missing lead id
    const warnings = Array.isArray(json.data?.warnings) ? json.data.warnings : []
    expect(warnings.join(' ')).not.toMatch(/missing lead id/i)
  })

  it('seeds demo trigger events when provider inserts none and demo enabled', async () => {
    const { POST } = await import('./route')
    const { hasAnyTriggerEvents, ingestRealTriggerEvents } = await import('@/lib/services/triggerEvents')

    const req = new NextRequest('http://localhost:3000/api/generate-pitch', {
      method: 'POST',
      body: JSON.stringify({ companyUrl: 'lego.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.hasTriggerEvent).toBe(true)
    expect(hasAnyTriggerEvents).toHaveBeenCalled()
    expect(ingestRealTriggerEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        companyDomain: 'lego.com',
        correlationId: expect.stringMatching(/^generate-pitch:/),
      })
    )
  })

  it('starter user over limit gets 429 and FREE_PLAN_LIMIT_REACHED (with header)', async () => {
    const { POST } = await import('./route')
    const { checkStarterPitchUsage } = await import('@/lib/billing/usage')
    const { generatePitch } = await import('@/lib/ai-logic')

    ;(checkStarterPitchUsage as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, limit: 20 })

    const req = new NextRequest('http://localhost:3000/api/generate-pitch', {
      method: 'POST',
      body: JSON.stringify({ companyUrl: 'dell.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(429)
    expect(res.headers.get('x-free-plan-limit')).toBe('20')
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('FREE_PLAN_LIMIT_REACHED')
    expect(generatePitch).not.toHaveBeenCalled()
  })

  it('starter user over 3-pitch cap gets 429 before generating', async () => {
    const { POST } = await import('./route')
    const { getStarterLeadCountFromDb, checkStarterPitchUsage } = await import('@/lib/billing/usage')
    const { generatePitch } = await import('@/lib/ai-logic')

    ;(getStarterLeadCountFromDb as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(3)

    const req = new NextRequest('http://localhost:3000/api/generate-pitch', {
      method: 'POST',
      body: JSON.stringify({ companyUrl: 'crypto.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(429)
    expect(res.headers.get('x-free-plan-limit')).toBe(String(STARTER_PITCH_CAP_LIMIT))
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('FREE_PLAN_LIMIT_REACHED')
    expect(generatePitch).not.toHaveBeenCalled()
    expect(checkStarterPitchUsage).not.toHaveBeenCalled()
  })

  it('closer user ignores starter cap and can generate pitch', async () => {
    mockSubscriptionRow = { status: 'active', stripe_price_id: process.env.STRIPE_PRICE_ID_PRO ?? 'price_test_pro' }
    mockIsPro = true
    const { POST } = await import('./route')
    const { checkStarterPitchUsage } = await import('@/lib/billing/usage')

    const req = new NextRequest('http://localhost:3000/api/generate-pitch', {
      method: 'POST',
      body: JSON.stringify({ companyUrl: 'dell.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(checkStarterPitchUsage).not.toHaveBeenCalled()
  })

  it('paid subscription with non-closer price is treated as closer and ignores starter cap', async () => {
    mockSubscriptionRow = { status: 'active', stripe_price_id: 'price_team_123' }
    process.env.STRIPE_PRICE_ID_PRO = 'price_test_pro_123'
    process.env.STRIPE_PRICE_ID = 'price_test_pro_123'
    process.env.STRIPE_PRICE_ID_TEAM = 'price_team_123'
    mockIsPro = true
    const { POST } = await import('./route')
    const { checkStarterPitchUsage } = await import('@/lib/billing/usage')

    const req = new NextRequest('http://localhost:3000/api/generate-pitch', {
      method: 'POST',
      body: JSON.stringify({ companyUrl: 'dell.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(checkStarterPitchUsage).not.toHaveBeenCalled()
  })
})

