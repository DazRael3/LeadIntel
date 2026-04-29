import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockTier: 'starter' | 'closer' = 'starter'
let mockUsed = 0
let mockReservedOk = true
let mockPitchPersistError = false

vi.mock('@/lib/services/triggerEvents', () => ({
  ingestRealTriggerEvents: vi.fn(async () => ({ created: 0 })),
  seedDemoTriggerEventsIfEmpty: vi.fn(async () => ({ created: 2 })),
  hasAnyTriggerEvents: vi.fn(async () => true),
  getLatestTriggerEvent: vi.fn(async () => ({ id: 'event_1' })),
}))

vi.mock('@/lib/billing/premium-generations', () => ({
  getPremiumGenerationCapabilities: vi.fn(async () => ({
    tier: mockTier,
    maxPremiumGenerations: mockTier === 'starter' ? 3 : null,
    blurPremiumSections: mockTier === 'starter',
    allowPremiumExport: false,
    allowFullCopy: mockTier !== 'starter',
  })),
  getPremiumGenerationUsage: vi.fn(async () => ({
    used: mockUsed,
    limit: 6,
    remaining: Math.max(0, 6 - mockUsed),
    byType: { pitch: mockUsed, report: 0 },
    limitsByType: { pitch: 3, report: 3 },
    remainingByType: { pitch: Math.max(0, 3 - mockUsed), report: 3 },
  })),
  reservePremiumGeneration: vi.fn(async () => (mockReservedOk ? { ok: true, reservationId: 'res_1' } : { ok: false })),
  completePremiumGeneration: vi.fn(async () => {}),
  cancelPremiumGeneration: vi.fn(async () => {}),
  redactTextPreview: (t: string) => t,
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
            return Promise.resolve({ error: mockPitchPersistError ? { message: 'persist failed' } : null })
          }
          return Promise.resolve({ error: null })
        },
      }),
    }
    return await fn(client)
  }),
}))

let mockPitchDiagnostics: {
  pitch: string
  provider: 'gemini' | 'template' | 'none' | null
  model: string | null
  requestId: string | null
  providerErrorCode:
    | 'AI_PROVIDER_UNAVAILABLE'
    | 'AI_RATE_LIMITED'
    | 'AI_TIMEOUT'
    | 'AI_PROVIDER_ERROR'
    | 'AI_PROVIDER_TEMPORARY'
    | 'AI_PROVIDER_MALFORMED_RESPONSE'
    | 'AI_QUOTA_EXCEEDED'
    | 'AI_PROVIDERS_UNAVAILABLE'
    | null
  templateFallbackUsed: boolean
  aiProviderUnavailable: boolean
} = {
  pitch: 'Mock pitch text',
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  requestId: 'req_pitch',
  providerErrorCode: null,
  templateFallbackUsed: false,
  aiProviderUnavailable: false,
}
let mockPitchThrowMessage: string | null = null

vi.mock('@/lib/ai-logic', () => ({
  generatePitchWithDiagnostics: vi.fn(async () => {
    if (mockPitchThrowMessage) throw new Error(mockPitchThrowMessage)
    return mockPitchDiagnostics
  }),
  generateBattleCard: vi.fn(async () => ({ currentTech: ['A'], painPoint: 'B', killerFeature: 'C' })),
  generateEmailSequence: vi.fn(async () => ({ part1: 'P1', part2: 'P2', part3: 'P3' })),
}))

describe('/api/generate-pitch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENABLE_DEMO_TRIGGER_EVENTS = 'true'
    mockSubscriptionRow = null
    mockTier = 'starter'
    mockUsed = 0
    mockReservedOk = true
    mockPitchPersistError = false
    mockPitchDiagnostics = {
      pitch: 'Mock pitch text',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      requestId: 'req_pitch',
      providerErrorCode: null,
      templateFallbackUsed: false,
      aiProviderUnavailable: false,
    }
    mockPitchThrowMessage = null
  })

  it('starter user under limit can generate pitch', async () => {
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
    expect(json.data?.isBlurred).toBe(true)
    expect(json.data?.pitch).toBe(null)
    expect(typeof json.data?.pitchPreview).toBe('string')
    expect(json.data?.generationCode).toBe(null)
  })

  it('returns success with TEMPLATE_FALLBACK_USED when provider falls back to template', async () => {
    mockPitchDiagnostics = {
      pitch: 'Template fallback pitch',
      provider: 'template',
      model: 'deterministic-template-v1',
      requestId: 'req_template',
      providerErrorCode: 'AI_PROVIDERS_UNAVAILABLE',
      templateFallbackUsed: true,
      aiProviderUnavailable: true,
    }
    const { POST } = await import('./route')

    const req = new NextRequest('http://localhost:3000/api/generate-pitch', {
      method: 'POST',
      body: JSON.stringify({ companyUrl: 'fallback.co' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.generationCode).toBe('TEMPLATE_FALLBACK_USED')
    expect(typeof json.data?.pitchPreview).toBe('string')
  })

  it('returns safe AI_PROVIDER_UNAVAILABLE error code when all providers fail and no fallback output can be produced', async () => {
    mockPitchThrowMessage = 'AI_PROVIDERS_UNAVAILABLE'
    const { POST } = await import('./route')

    const req = new NextRequest('http://localhost:3000/api/generate-pitch', {
      method: 'POST',
      body: JSON.stringify({ companyUrl: 'downstream.ai' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('AI_PROVIDER_UNAVAILABLE')
  })

  it('continues returning pitch output when pitch persistence fails', async () => {
    mockPitchPersistError = true
    const { POST } = await import('./route')

    const req = new NextRequest('http://localhost:3000/api/generate-pitch', {
      method: 'POST',
      body: JSON.stringify({ companyUrl: 'persist-fail.co' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(typeof json.data?.pitchPreview).toBe('string')
    const warnings = Array.isArray(json.data?.warnings) ? json.data.warnings : []
    expect(warnings).toContain('Pitch history persistence failed.')
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
    const { generatePitchWithDiagnostics } = await import('@/lib/ai-logic')
    mockUsed = 3

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
    expect(generatePitchWithDiagnostics).not.toHaveBeenCalled()
  })

  it('returns safe AI_PROVIDER_UNAVAILABLE when diagnostics throw provider unavailable', async () => {
    mockPitchThrowMessage = 'AI_PROVIDER_UNAVAILABLE'
    const { POST } = await import('./route')

    const req = new NextRequest('http://localhost:3000/api/generate-pitch', {
      method: 'POST',
      body: JSON.stringify({ companyUrl: 'dell.com' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('AI_PROVIDER_UNAVAILABLE')
  })

  it('closer user ignores starter cap and can generate pitch', async () => {
    mockTier = 'closer'
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
    expect(json.data?.isBlurred).toBe(false)
    expect(typeof json.data?.pitch).toBe('string')
  })

  it('paid subscription with non-closer price is treated as closer and ignores starter cap', async () => {
    mockSubscriptionRow = { status: 'active', stripe_price_id: 'price_team_123' }
    process.env.STRIPE_PRICE_ID_PRO = 'price_test_pro_123'
    process.env.STRIPE_PRICE_ID = 'price_test_pro_123'
    process.env.STRIPE_PRICE_ID_TEAM = 'price_team_123'
    mockTier = 'closer'
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
  })
})

