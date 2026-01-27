import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { isPro } from '@/lib/billing/plan'

type StoredRow = {
  user_id: string
  symbol: string
  instrument_type: 'stock' | 'crypto'
  position: number
}

let store: StoredRow[] = []

class FakeQuery {
  private table: string
  private mode: 'select' | 'delete' | 'insert' = 'select'
  private filters: Record<string, unknown> = {}
  private orderBy: { col: string; asc: boolean } | null = null

  constructor(table: string) {
    this.table = table
  }

  select() {
    this.mode = 'select'
    return this
  }

  delete() {
    this.mode = 'delete'
    return this
  }

  insert(rows: unknown) {
    this.mode = 'insert'
    const arr = Array.isArray(rows) ? rows : [rows]
    for (const r of arr) {
      const row = r as StoredRow
      store.push({
        user_id: row.user_id,
        symbol: row.symbol,
        instrument_type: row.instrument_type,
        position: row.position,
      })
    }
    return Promise.resolve({ data: null, error: null })
  }

  eq(column: string, value: unknown) {
    this.filters[column] = value
    return this
  }

  order(col: string, opts: { ascending: boolean }) {
    this.orderBy = { col, asc: opts.ascending }
    return this
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const run = async () => {
      if (this.table !== 'watchlist_symbols') {
        return { data: null, error: null }
      }

      const userId = this.filters.user_id as string | undefined

      if (this.mode === 'delete') {
        if (userId) store = store.filter((r) => r.user_id !== userId)
        return { data: null, error: null }
      }

      // select
      let rows = store.slice()
      if (userId) rows = rows.filter((r) => r.user_id === userId)
      if (this.orderBy?.col === 'position') {
        rows.sort((a, b) => (this.orderBy?.asc ? a.position - b.position : b.position - a.position))
      }
      return { data: rows, error: null }
    }

    return run().then((v) => (onfulfilled ? onfulfilled(v) : (v as unknown as TResult1)))
  }
}

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user_1', email: 'u@example.com' } }, error: null })),
    },
    from: (table: string) => new FakeQuery(table),
  })),
}))

vi.mock('@/lib/billing/plan', () => ({
  isPro: vi.fn(),
}))

const isProMock = vi.mocked(isPro)

describe('/api/watchlist', () => {
  beforeEach(() => {
    store = []
    vi.clearAllMocks()
  })

  it('GET returns empty list when no rows exist', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/watchlist', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.items).toEqual([])
  })

  it('PUT is forbidden for non-pro users', async () => {
    isProMock.mockResolvedValue(false)
    const { PUT } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/watchlist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ items: [{ symbol: 'AAPL', instrumentType: 'stock' }] }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(403)
  })

  it('PUT replaces watchlist for pro users and GET returns ordered items', async () => {
    isProMock.mockResolvedValue(true)
    const { PUT, GET } = await import('./route')

    const putReq = new NextRequest('http://localhost:3000/api/watchlist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        items: [
          { symbol: 'msft', instrumentType: 'stock' },
          { symbol: 'btc', instrumentType: 'crypto' },
        ],
      }),
    })
    const putRes = await PUT(putReq)
    expect(putRes.status).toBe(200)

    const getRes = await GET(new NextRequest('http://localhost:3000/api/watchlist', { method: 'GET' }))
    const json = await getRes.json()
    expect(json.ok).toBe(true)
    expect(json.data.items.map((i: any) => i.symbol)).toEqual(['MSFT', 'BTC'])
    expect(json.data.items.map((i: any) => i.position)).toEqual([0, 1])
  })
})

