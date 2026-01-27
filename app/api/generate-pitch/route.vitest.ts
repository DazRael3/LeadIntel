import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/billing/plan', () => ({
  isPro: vi.fn(async () => true),
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
      from: (_table: string) => ({
        upsert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'lead_1' }, error: null }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'event_1' }, error: null }),
          }),
        }),
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

describe('/api/generate-pitch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})

