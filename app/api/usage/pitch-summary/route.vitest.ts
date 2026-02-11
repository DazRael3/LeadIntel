import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { STARTER_PITCH_CAP_LIMIT } from '@/lib/billing/constants'

let mockSubRow: unknown = null
let mockUserRow: unknown = null
let mockLeadCount = 0

vi.mock('@/lib/billing/usage', () => ({
  getStarterLeadCountFromDb: vi.fn(async () => mockLeadCount),
  getStarterPitchCapSummary: vi.fn(async () => ({ used: 0, limit: STARTER_PITCH_CAP_LIMIT })),
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
  maybeSingle() {
    if (this.table === 'subscriptions') return Promise.resolve({ data: mockSubRow, error: null })
    if (this.table === 'users') return Promise.resolve({ data: mockUserRow, error: null })
    return Promise.resolve({ data: null, error: null })
  }
}

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null })),
    },
    from: (table: string) => new FakeQuery(table),
    schema: () => ({
      from: (table: string) => new FakeQuery(table),
    }),
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => new FakeQuery(table),
  })),
}))

describe('/api/usage/pitch-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockSubRow = null
    mockUserRow = null
    mockLeadCount = 0

    process.env.STRIPE_PRICE_ID_PRO = 'price_pro_123'
    process.env.STRIPE_PRICE_ID = 'price_pro_123'
  })

  it('returns starter tier with a limit of 3', async () => {
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/usage/pitch-summary', { method: 'GET' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tier).toBe('starter')
    expect(json.data?.pitchesLimit).toBe(STARTER_PITCH_CAP_LIMIT)
    expect(json.data?.pitchesUsed).toBe(0)
  })

  it('uses DB lead count for pitchesUsed (clamped to 3)', async () => {
    mockLeadCount = 10
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/usage/pitch-summary', { method: 'GET' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tier).toBe('starter')
    expect(json.data?.pitchesLimit).toBe(STARTER_PITCH_CAP_LIMIT)
    expect(json.data?.pitchesUsed).toBe(STARTER_PITCH_CAP_LIMIT)
  })

  it('paid tier returns pitchesLimit null (no 3-pitch cap)', async () => {
    mockSubRow = { status: 'active', stripe_price_id: 'price_pro_123' }
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/usage/pitch-summary', { method: 'GET' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data?.tier).toBe('closer')
    expect(json.data?.pitchesLimit).toBe(null)
  })
})

