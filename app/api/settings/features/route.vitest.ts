import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const upsertedRows: unknown[] = []

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1' } }, error: null })),
    },
    from: (table: string) => {
      if (table !== 'feature_flags') throw new Error('unexpected table')
      return {
        upsert: (rows: unknown) => {
          upsertedRows.push(rows)
          return {
            select: async () => ({ data: [{ feature: 'clearbit_enrichment', enabled: false }], error: null }),
          }
        },
      }
    },
  })),
}))

describe('/api/settings/features', () => {
  beforeEach(() => {
    upsertedRows.splice(0, upsertedRows.length)
    vi.clearAllMocks()
  })

  it('upserts only for authenticated user (tenant scoped)', async () => {
    const { POST } = await import('./route')

    const req = new NextRequest('http://localhost:3000/api/settings/features', {
      method: 'POST',
      body: JSON.stringify({ clearbit_enrichment: false }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(upsertedRows.length).toBe(1)

    const rows = upsertedRows[0] as any[]
    expect(rows[0]).toMatchObject({ user_id: 'user_1', feature: 'clearbit_enrichment', enabled: false })
  })
})

