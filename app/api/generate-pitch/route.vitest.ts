import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/billing/plan', () => ({
  isPro: vi.fn(async () => true),
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
    return Promise.resolve({ data: null, error: null })
  }
}

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null })),
    },
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
}))

describe('/api/generate-pitch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENABLE_DEMO_TRIGGER_EVENTS = 'true'
  })

  it('returns ok envelope with canonical data.pitch when pitch exists', async () => {
    const { POST } = await import('./route')

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

  it('returns 429 when Starter daily cap is reached', async () => {
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
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('FREE_PLAN_LIMIT_REACHED')
    expect(generatePitch).not.toHaveBeenCalled()
  })
})

