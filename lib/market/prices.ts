import type { InstrumentDefinition, InstrumentKind } from './instruments'
import type { MarketQuote } from '@/lib/market/quotes'
import { toMarketQuote } from '@/lib/market/quotes'

/**
 * Backwards-compatible alias for the canonical market quote model.
 *
 * Historical UI code expects `price` + `changePct`; newer code should prefer
 * `lastPrice` + `changePercent`.
 */
export type InstrumentQuote = MarketQuote

type CacheEntry = { at: number; quotes: InstrumentQuote[] }
const clientQuoteCache = new Map<string, CacheEntry>()
const clientQuoteInflight = new Map<string, Promise<InstrumentQuote[]>>()
const CLIENT_CACHE_TTL_MS = 12_000

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
export function generateMockInstrumentQuotes(instruments: InstrumentDefinition[], now: Date = new Date()): InstrumentQuote[] {
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

    const priceOut = Number.isFinite(price) ? Number(price.toFixed(2)) : null
    const pctOut = Number.isFinite(pct) ? Number(pct.toFixed(2)) : null
    return toMarketQuote({
      symbol: inst.symbol,
      kind: inst.kind,
      price: priceOut,
      changePct: pctOut,
      updatedAt: now.toISOString(),
    })
  })

  return quotes
}

function toClientCacheKey(instruments: InstrumentDefinition[]): string {
  const key = instruments
    .map((i) => `${i.kind}:${i.symbol}`.trim().toUpperCase())
    .filter((x) => x.length > 0)
    .slice()
    .sort()
    .join(',')
  return key
}

/**
 * Fetch quotes via server API if available/configured; fall back to deterministic mock quotes.
 * This keeps local dev + tests working without external providers or secrets.
 */
export async function fetchInstrumentQuotes(instruments: InstrumentDefinition[]): Promise<InstrumentQuote[]> {
  if (instruments.length === 0) return []
  const key = toClientCacheKey(instruments)
  const now = Date.now()
  const cached = clientQuoteCache.get(key)
  if (cached && now - cached.at < CLIENT_CACHE_TTL_MS) return cached.quotes

  const inflight = clientQuoteInflight.get(key)
  if (inflight) return inflight
  try {
    const p = (async () => {
      try {
        const res = await fetch('/api/market/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruments: instruments.map((i) => ({ symbol: i.symbol, kind: i.kind, name: i.name })) }),
        })
        // Production safety: never fabricate prices in the client.
        if (!res.ok) {
          const fallback = process.env.NODE_ENV === 'production' ? [] : generateMockInstrumentQuotes(instruments)
          clientQuoteCache.set(key, { at: Date.now(), quotes: fallback })
          return fallback
        }
        const json = (await res.json()) as unknown
        if (typeof json !== 'object' || json === null) {
          const fallback = process.env.NODE_ENV === 'production' ? [] : generateMockInstrumentQuotes(instruments)
          clientQuoteCache.set(key, { at: Date.now(), quotes: fallback })
          return fallback
        }
        const maybe = json as { ok?: unknown; data?: unknown }
        if (maybe.ok !== true) {
          const fallback = process.env.NODE_ENV === 'production' ? [] : generateMockInstrumentQuotes(instruments)
          clientQuoteCache.set(key, { at: Date.now(), quotes: fallback })
          return fallback
        }
        const data = maybe.data as { quotes?: unknown }
        if (!data || !Array.isArray(data.quotes)) {
          const fallback = process.env.NODE_ENV === 'production' ? [] : generateMockInstrumentQuotes(instruments)
          clientQuoteCache.set(key, { at: Date.now(), quotes: fallback })
          return fallback
        }
        // Best-effort return; the API already normalizes and falls back per-symbol.
        const quotes = data.quotes as InstrumentQuote[]
        clientQuoteCache.set(key, { at: Date.now(), quotes })
        return quotes
      } catch {
        const fallback = process.env.NODE_ENV === 'production' ? [] : generateMockInstrumentQuotes(instruments)
        clientQuoteCache.set(key, { at: Date.now(), quotes: fallback })
        return fallback
      } finally {
        clientQuoteInflight.delete(key)
      }
    })()

    clientQuoteInflight.set(key, p)
    return await p
  } catch {
    const fallback = process.env.NODE_ENV === 'production' ? [] : generateMockInstrumentQuotes(instruments)
    clientQuoteCache.set(key, { at: Date.now(), quotes: fallback })
    return fallback
  }
}

