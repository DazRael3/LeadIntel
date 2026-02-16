import type { InstrumentKind } from '@/lib/market/instruments'

/**
 * Canonical internal quote shape used by the frontend (ticker/watchlist/markets).
 *
 * Providers may return different raw fields; we normalize into this model so UI code
 * doesn't need provider-specific logic.
 *
 * Notes:
 * - `lastPrice` is always USD for the currently supported providers.
 * - `changePercent` is a true percentage (e.g. +1.23 means +1.23%).
 * - `price`/`changePct` are kept for backwards compatibility with older UI code.
 */
export type MarketQuote = {
  symbol: string // e.g. "AAPL" or "BTC-USD"
  kind: InstrumentKind // "stock" | "crypto"
  lastPrice: number | null // USD
  /** Alias for clarity in downstream consumers. */
  lastPriceUsd?: number | null
  changePercent: number | null // +/- percent, not fraction
  /** Best-effort absolute USD change for display; may be null. */
  change: number | null
  currency: 'USD'
  updatedAt: string | null
  logoUrl?: string | null
  /** Optional provenance; never includes secrets. */
  source?: 'provider' | 'coingecko' | 'mock'

  // Backwards compatible aliases:
  price: number | null
  changePct: number | null
}

function safeRound(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

export function toMarketQuote(input: {
  symbol: string
  kind: InstrumentKind
  price: number | null
  changePct: number | null
  updatedAt: string | null
  logoUrl?: string | null
  source?: MarketQuote['source']
}): MarketQuote {
  const lastPrice = input.price
  const changePercent = input.changePct

  let change: number | null = null
  if (typeof lastPrice === 'number' && Number.isFinite(lastPrice) && typeof changePercent === 'number' && Number.isFinite(changePercent)) {
    // If changePercent is based on prevClose: pct = (last - prev) / prev * 100
    // => prev = last / (1 + pct/100) ; change = last - prev
    const denom = 1 + changePercent / 100
    if (denom !== 0) {
      const prev = lastPrice / denom
      const next = lastPrice - prev
      if (Number.isFinite(next)) change = safeRound(next, 6)
    }
  }

  return {
    symbol: input.symbol,
    kind: input.kind,
    lastPrice,
    lastPriceUsd: lastPrice,
    changePercent,
    change,
    currency: 'USD',
    updatedAt: input.updatedAt,
    logoUrl: input.logoUrl ?? null,
    source: input.source,
    price: input.price,
    changePct: input.changePct,
  }
}

export function getQuotePriceDecimals(kind: InstrumentKind, lastPrice: number): number {
  if (kind !== 'crypto') return 2
  // Crypto: show more precision for low-priced assets, but avoid noisy trailing zeros for high-priced ones.
  if (lastPrice >= 1000) return 2
  if (lastPrice >= 100) return 3
  return 4
}

/**
 * Defensive validator: ensure all quotes are USD-denominated.
 * In production, this should always be true.
 */
export function allQuotesAreUsd(quotes: Array<Pick<MarketQuote, 'currency'>>): boolean {
  return quotes.every((q) => q.currency === 'USD')
}

