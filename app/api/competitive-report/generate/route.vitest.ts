import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockAuthedUser: { id: string } | null = { id: 'user_1' }

type InsertRow = { id: string }
let insertedRow: InsertRow | null = { id: 'rep_1' }

type TableName = 'user_settings' | 'trigger_events' | 'user_reports'

let mockTier: 'starter' | 'closer' = 'closer'
let mockUsed = 0
let mockReservedOk = true

class MockQuery {
  private table: TableName
  constructor(table: TableName) {
    this.table = table
  }
  select() {
    return this
  }
  eq() {
    return this
  }
  gte() {
    return this
  }
  order() {
    return this
  }
  limit() {
    return this
  }
  maybeSingle = async () => {
    if (this.table === 'user_settings') {
      return { data: { what_you_sell: 'LeadIntel', ideal_customer: 'Outbound teams' }, error: null }
    }
    return { data: null, error: null }
  }
  insert() {
    return this
  }
  single = async () => {
    return { data: insertedRow, error: null }
  }
  then = async (resolve: (v: unknown) => unknown, _reject?: (e: unknown) => unknown) => {
    // Used for `await q` on trigger_events query.
    if (this.table === 'trigger_events') {
      return resolve({
        data: [
          {
            headline: 'Internal signal: example (verify)',
            event_type: 'expansion',
            detected_at: '2026-01-01T00:00:00.000Z',
            source_url: 'https://example.com',
            event_description: 'Captured by internal detection.',
          },
        ],
        error: null,
      })
    }
    return resolve({ data: null, error: null })
  }
}

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
    limit: 3,
    remaining: Math.max(0, 3 - mockUsed),
    byType: { pitch: 0, report: mockUsed },
  })),
  reservePremiumGeneration: vi.fn(async () => (mockReservedOk ? { ok: true, reservationId: 'res_1' } : { ok: false })),
  completePremiumGeneration: vi.fn(async () => {}),
  cancelPremiumGeneration: vi.fn(async () => {}),
  redactTextPreview: (t: string) => t,
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAuthedUser }, error: null })),
    },
    from: (table: TableName) => new MockQuery(table),
  })),
}))

vi.mock('@/lib/sources/orchestrate', () => ({
  refreshCompanySourcesForReport: vi.fn(async () => ({
    ok: true,
    resolvedCompanyName: 'Google',
    data: { companyKey: 'ticker:GOOG', refreshed: [], failed: [], fetchedAt: new Date().toISOString() },
    bundle: {
      companyKey: 'ticker:GOOG',
      fetchedAt: new Date().toISOString(),
      sources: {},
      allCitations: [
        { url: 'https://example.org/a', type: 'news', source: 'GDELT' },
        { url: 'https://example.org/b', type: 'news', source: 'GDELT' },
      ],
    },
  })),
}))

describe('/api/competitive-report/generate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuthedUser = { id: 'user_1' }
    insertedRow = { id: 'rep_1' }
    mockTier = 'closer'
    mockUsed = 0
    mockReservedOk = true
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('unauthenticated -> 401', async () => {
    mockAuthedUser = null
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/competitive-report/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ company_name: 'Google' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('authenticated -> saves report and returns id', async () => {
    mockTier = 'starter'
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/competitive-report/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ company_name: 'Google', company_domain: 'google.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(typeof json.data?.reportId).toBe('string')
    // Starter gets redacted payload (no full markdown).
    expect(json.data?.report_markdown ?? null).toBe(null)
  })

  it('free plan with 3 reports -> 429', async () => {
    mockTier = 'starter'
    mockUsed = 3
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/competitive-report/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ company_name: 'Google', company_domain: 'google.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error?.code).toBe('FREE_TIER_GENERATION_LIMIT_REACHED')
  })
})

