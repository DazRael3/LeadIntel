import { describe, expect, it } from 'vitest'
import { DEFAULT_INSTRUMENTS } from './instruments'

describe('DEFAULT_INSTRUMENTS', () => {
  it('contains ~20 stocks and 5 cryptos', () => {
    const stocks = DEFAULT_INSTRUMENTS.filter((i) => i.kind === 'stock' && i.defaultVisible)
    const cryptos = DEFAULT_INSTRUMENTS.filter((i) => i.kind === 'crypto' && i.defaultVisible)
    expect(stocks).toHaveLength(20)
    expect(cryptos).toHaveLength(5)
  })

  it('has unique (kind,symbol) pairs', () => {
    const keys = DEFAULT_INSTRUMENTS.map((i) => `${i.kind}:${i.symbol}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

