import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addInstrumentToWatchlist, getUserWatchlist, removeInstrumentFromWatchlist } from './watchlist'

function makeClientMock() {
  const chain: any = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: { sort_order: 0 }, error: null })),
    upsert: vi.fn(async () => ({ data: null, error: null })),
    delete: vi.fn(() => chain),
  }

  return {
    from: vi.fn(() => chain),
    __chain: chain,
  }
}

describe('watchlist service', () => {
  it('getUserWatchlist returns instrument definitions from rows', async () => {
    const client = makeClientMock()
    client.__chain.select.mockReturnValueOnce({
      ...client.__chain,
      eq: vi.fn(() => ({
        ...client.__chain,
        order: vi.fn(async () => ({
          data: [
            { symbol: 'AAPL', kind: 'stock', display_name: 'Apple', sort_order: 0 },
            { symbol: 'BTC-USD', kind: 'crypto', display_name: 'Bitcoin', sort_order: 1 },
          ],
          error: null,
        })),
      })),
    })

    const res = await getUserWatchlist(client as unknown as SupabaseClient, 'user_1')
    expect(res.map((i) => i.symbol)).toEqual(['AAPL', 'BTC-USD'])
  })

  it('addInstrumentToWatchlist rejects unknown instruments', async () => {
    const client = makeClientMock()
    const res = await addInstrumentToWatchlist(client as unknown as SupabaseClient, 'user_1', { symbol: '***', kind: 'stock' })
    expect(res.ok).toBe(false)
  })

  it('removeInstrumentFromWatchlist rejects unknown instruments', async () => {
    const client = makeClientMock()
    const res = await removeInstrumentFromWatchlist(client as unknown as SupabaseClient, 'user_1', { symbol: '***', kind: 'stock' })
    expect(res.ok).toBe(false)
  })
})

