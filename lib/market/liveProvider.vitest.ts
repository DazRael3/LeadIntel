import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fetchQuotesForSymbols } from './liveProvider'

describe('liveProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('finnhub maps c (price) and dp (percent) correctly', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ c: 123.45, dp: 1.23, t: 1700000000 }),
    } as unknown as Response)

    const out = await fetchQuotesForSymbols({
      provider: 'finnhub',
      apiKey: 'key',
      symbols: ['AAPL'],
      debug: true,
    })

    expect(fetchSpy).toHaveBeenCalled()
    expect(out).toHaveLength(1)
    expect(out[0]?.symbol).toBe('AAPL')
    expect(out[0]?.price).toBe(123.45)
    expect(out[0]?.changePct).toBe(1.23)
    expect(typeof out[0]?.updatedAt).toBe('string')
    expect(out[0]?.raw).toEqual({ c: 123.45, dp: 1.23, t: 1700000000 })
  })

  it('polygon prev endpoint computes percent from open->close', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ o: 100, c: 110, t: 1700000000000 }] }),
    } as unknown as Response)

    const out = await fetchQuotesForSymbols({
      provider: 'polygon',
      apiKey: 'key',
      symbols: ['AAPL'],
      debug: true,
    })

    expect(out).toHaveLength(1)
    expect(out[0]?.price).toBe(110)
    // (110-100)/100*100 = 10
    expect(out[0]?.changePct).toBe(10)
    expect(out[0]?.raw).toEqual({ results: [{ o: 100, c: 110, t: 1700000000000 }] })
  })

  it('handles missing/invalid provider fields without throwing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ c: 'nope', dp: null }),
    } as unknown as Response)

    const out = await fetchQuotesForSymbols({
      provider: 'finnhub',
      apiKey: 'key',
      symbols: ['AAPL'],
    })

    expect(out).toHaveLength(1)
    expect(out[0]?.price).toBeNull()
    expect(out[0]?.changePct).toBeNull()
  })
})

