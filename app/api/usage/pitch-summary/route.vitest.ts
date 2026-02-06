import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let mockSubRow: unknown = null
let mockUserRow: unknown = null
let mockPitchCount: number | null = null

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
      from: (table: string) => {
        if (table === 'pitches') {
          return {
            select: () => ({
              eq: async () => ({ count: mockPitchCount, data: null, error: null }),
            }),
          }
        }
        return new FakeQuery(table)
      },
    }),
  })),
}))

describe('/api/usage/pitch-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockSubRow = null
    mockUserRow = null
    mockPitchCount = 0

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
    expect(json.data?.pitchesLimit).toBe(3)
    expect(json.data?.pitchesUsed).toBe(0)
  })
})

