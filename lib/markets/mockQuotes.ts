import type { DefaultInstrument, InstrumentType } from './defaultWatchlist'

export interface MarketQuote {
  symbol: string
  instrumentType: InstrumentType
  price: number
  change: number
  changePercent: number
  label?: string
}

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

/**
 * Deterministic pseudo-quotes for UI development.
 * Avoids external dependencies and keeps UI stable across renders.
 */
export function getMockQuote(instrument: DefaultInstrument, now: number = Date.now()): MarketQuote {
  const base = hashString(`${instrument.type}:${instrument.symbol}`)

  // A tiny oscillation so values aren't perfectly static.
  const wave = Math.sin((now / 1000 + (base % 30)) / 12)

  const priceBase =
    instrument.type === 'crypto'
      ? // Crypto prices span a wider range
        10 + (base % 50000)
      : // Stocks roughly 10..1000
        10 + (base % 990)

  const price = priceBase * (1 + wave * 0.002)

  const changePercent = clamp(((base % 500) - 250) / 100, -5, 5) + wave * 0.15
  const change = (price * changePercent) / 100

  return {
    symbol: instrument.symbol,
    instrumentType: instrument.type,
    price,
    change,
    changePercent,
    label: instrument.label,
  }
}

export function getMockQuotes(instruments: DefaultInstrument[], now: number = Date.now()): MarketQuote[] {
  return instruments.map((i) => getMockQuote(i, now))
}

