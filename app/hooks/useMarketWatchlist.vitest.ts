import { describe, expect, it } from 'vitest'
import type { InstrumentDefinition } from '@/lib/market/instruments'
import { mergeVisibleInstruments } from './useMarketWatchlist'

describe('mergeVisibleInstruments', () => {
  it('deduplicates by kind+symbol and keeps user override', () => {
    const defaults: InstrumentDefinition[] = [
      { symbol: 'AAPL', name: 'Apple', kind: 'stock', defaultVisible: true, order: 1 },
    ]
    const user: InstrumentDefinition[] = [
      { symbol: 'AAPL', name: 'Apple Inc', kind: 'stock', defaultVisible: true, order: 1000 },
      { symbol: 'BTC-USD', name: 'Bitcoin', kind: 'crypto', defaultVisible: true, order: 1001 },
    ]

    const merged = mergeVisibleInstruments(defaults, user)
    expect(merged.map((i) => `${i.kind}:${i.symbol}`)).toEqual(['stock:AAPL', 'crypto:BTC-USD'])
    expect(merged.find((i) => i.symbol === 'AAPL')?.name).toBe('Apple Inc')
  })
})

