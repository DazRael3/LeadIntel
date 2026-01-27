import type { InstrumentDefinition, InstrumentKind } from './instruments'

export interface InstrumentQuote {
  symbol: string
  price: number | null
  changePct: number | null
  kind: InstrumentKind
  updatedAt: string | null
}

function stableHash(input: string): number {
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

function dayKey(now: Date): string {
  // UTC day key so values are stable across timezones for a given date.
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Deterministic pseudo quotes (no external API).
 * Produces realistic-looking values that change daily, plus a tiny intra-hour drift.
 */
export async function fetchInstrumentQuotes(instruments: InstrumentDefinition[]): Promise<InstrumentQuote[]> {
  const now = new Date()
  const dk = dayKey(now)
  const hour = now.getUTCHours()

  const quotes = instruments.map((inst) => {
    const baseSeed = stableHash(`${dk}:${inst.kind}:${inst.symbol}`)
    const driftSeed = stableHash(`${dk}:${hour}:${inst.symbol}`)

    // Daily change percent: approx -5%..+5% (crypto slightly wider).
    const pctBase = ((baseSeed % 1001) - 500) / 100
    const pct = clamp(pctBase + ((driftSeed % 41) - 20) / 100, inst.kind === 'crypto' ? -12 : -7, inst.kind === 'crypto' ? 12 : 7)

    // Price baseline varies by kind.
    const priceBase =
      inst.kind === 'crypto'
        ? // 50..60k-ish range
          50 + (baseSeed % 60000)
        : // 10..1500-ish range
          10 + (baseSeed % 1490)

    const price = priceBase * (1 + pct / 100)

    return {
      symbol: inst.symbol,
      kind: inst.kind,
      price: Number.isFinite(price) ? Number(price.toFixed(2)) : null,
      changePct: Number.isFinite(pct) ? Number(pct.toFixed(2)) : null,
      updatedAt: now.toISOString(),
    } satisfies InstrumentQuote
  })

  return quotes
}

