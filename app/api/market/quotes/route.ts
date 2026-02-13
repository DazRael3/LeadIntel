import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, createCookieBridge, asHttpError } from '@/lib/api/http'
import type { InstrumentDefinition, InstrumentKind } from '@/lib/market/instruments'
import type { InstrumentQuote } from '@/lib/market/prices'
import { generateMockInstrumentQuotes } from '@/lib/market/prices'
import { getServerEnv } from '@/lib/env'
import { fetchQuotesForSymbols } from '@/lib/market/liveProvider'
import { toMarketQuote } from '@/lib/market/quotes'
import { logger } from '@/lib/observability/logger'

const InstrumentKindSchema = z.enum(['stock', 'crypto'])

const QuotesBodySchema = z.object({
  instruments: z
    .array(
      z.object({
        symbol: z
          .string()
          .trim()
          .transform((s) => s.toUpperCase())
          .refine((s) => /^[A-Z0-9][A-Z0-9.\-]{0,23}$/.test(s), 'Invalid symbol'),
        kind: InstrumentKindSchema,
        name: z.string().trim().max(64).optional(),
      })
    )
    .max(60),
})

type QuotesBody = z.infer<typeof QuotesBodySchema>

const cache = new Map<string, { at: number; quotes: InstrumentQuote[] }>()
const CACHE_TTL_MS = 20_000

const logoCache = new Map<string, { at: number; logoUrl: string | null }>()
const logoInflight = new Map<string, Promise<string | null>>()
const LOGO_TTL_MS = 24 * 60 * 60 * 1000

let hasLoggedProviderUnconfigured = false
let hasLoggedFallback = false

type LiveLikeQuote = { price: number | null; changePct: number | null; updatedAt: string | null }

function isValidPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function shouldLogOnce(flag: boolean): boolean {
  return !flag
}

function getCoinGeckoIdForSymbol(symbol: string): string | null {
  // Map our provider-agnostic crypto symbols to CoinGecko ids.
  // Only include the curated defaults for now.
  switch (symbol.trim().toUpperCase()) {
    case 'BTC-USD':
      return 'bitcoin'
    case 'ETH-USD':
      return 'ethereum'
    case 'SOL-USD':
      return 'solana'
    case 'BNB-USD':
      return 'binancecoin'
    case 'XRP-USD':
      return 'ripple'
    default:
      return null
  }
}

async function fetchCoinGeckoUsdQuotes(symbols: string[]): Promise<Map<string, LiveLikeQuote>> {
  const pairs = symbols
    .map((s) => ({ symbol: s.trim().toUpperCase(), id: getCoinGeckoIdForSymbol(s) }))
    .filter((x): x is { symbol: string; id: string } => Boolean(x.id))

  const ids = Array.from(new Set(pairs.map((p) => p.id)))
  const out = new Map<string, LiveLikeQuote>()
  if (ids.length === 0) return out

  const url = new URL('https://api.coingecko.com/api/v3/simple/price')
  url.searchParams.set('ids', ids.join(','))
  url.searchParams.set('vs_currencies', 'usd')
  url.searchParams.set('include_24hr_change', 'true')

  const res = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } })
  if (!res.ok) return out
  const json = (await res.json()) as unknown
  if (typeof json !== 'object' || json === null) return out

  const nowIso = new Date().toISOString()
  const root = json as Record<string, unknown>
  for (const { symbol, id } of pairs) {
    const row = root[id]
    if (typeof row !== 'object' || row === null) continue
    const r = row as { usd?: unknown; usd_24h_change?: unknown }
    const price = typeof r.usd === 'number' && Number.isFinite(r.usd) ? r.usd : null
    const changePct = typeof r.usd_24h_change === 'number' && Number.isFinite(r.usd_24h_change) ? r.usd_24h_change : null
    out.set(symbol, { price, changePct, updatedAt: nowIso })
  }

  return out
}

function sampleCryptoQuote(symbol: string): LiveLikeQuote | null {
  // Last-resort hardcoded samples (USD).
  // Used only if both primary provider and CoinGecko are unavailable.
  const nowIso = new Date().toISOString()
  switch (symbol.trim().toUpperCase()) {
    case 'BTC-USD':
      return { price: 50_000, changePct: 0.5, updatedAt: nowIso }
    case 'ETH-USD':
      return { price: 2_500, changePct: 0.4, updatedAt: nowIso }
    case 'SOL-USD':
      return { price: 100, changePct: 0.3, updatedAt: nowIso }
    case 'BNB-USD':
      return { price: 350, changePct: 0.2, updatedAt: nowIso }
    case 'XRP-USD':
      return { price: 0.6, changePct: 0.1, updatedAt: nowIso }
    default:
      return null
  }
}

async function fetchFinnhubLogo(symbol: string, apiKey: string): Promise<string | null> {
  const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } })
  if (!res.ok) return null
  const json = (await res.json()) as unknown
  const logo = (json as any)?.logo
  return typeof logo === 'string' && logo.trim().length > 0 ? logo.trim() : null
}

async function getLogoUrl(symbol: string, apiKey: string): Promise<string | null> {
  const key = symbol.trim().toUpperCase()
  const now = Date.now()
  const cached = logoCache.get(key)
  if (cached && now - cached.at < LOGO_TTL_MS) return cached.logoUrl

  const inflight = logoInflight.get(key)
  if (inflight) return inflight

  const p = (async () => {
    try {
      const logoUrl = await fetchFinnhubLogo(key, apiKey)
      logoCache.set(key, { at: now, logoUrl })
      return logoUrl
    } catch {
      logoCache.set(key, { at: now, logoUrl: null })
      return null
    } finally {
      logoInflight.delete(key)
    }
  })()
  logoInflight.set(key, p)
  return p
}

function toInstrumentDefs(input: QuotesBody['instruments']): InstrumentDefinition[] {
  return input.map((i, idx) => ({
    symbol: i.symbol,
    kind: i.kind as InstrumentKind,
    name: i.name || i.symbol,
    defaultVisible: true,
    order: idx,
  }))
}

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const parsed = body as QuotesBody
      const instruments = parsed.instruments ?? []
      const cacheKey = instruments
        .map((i) => `${i.kind}:${i.symbol}`)
        .slice()
        .sort()
        .join(',')

      const now = Date.now()
      const hit = cache.get(cacheKey)
      if (hit && now - hit.at < CACHE_TTL_MS) {
        return ok({ quotes: hit.quotes }, undefined, bridge, requestId)
      }

      const defs = toInstrumentDefs(instruments)
      const mockQuotes = generateMockInstrumentQuotes(defs, new Date(now))
      let quotes = mockQuotes

      const env = getServerEnv()
      const provider = env.MARKET_DATA_PROVIDER
      const apiKey = env.MARKET_DATA_API_KEY
      const debugRequested = request.nextUrl.searchParams.get('debug') === 'true'
      const debugEnabled = debugRequested && env.NODE_ENV !== 'production'
      const debugRawBySymbol: Record<string, unknown> = {}
      if (provider && provider !== 'none' && !apiKey) {
        if (shouldLogOnce(hasLoggedProviderUnconfigured)) {
          logger.warn({
            level: 'warn',
            scope: 'market',
            message: 'quotes.provider_unconfigured',
            provider,
            missingEnvVars: ['MARKET_DATA_API_KEY'],
          })
          hasLoggedProviderUnconfigured = true
        }
      }

      if (provider && provider !== 'none' && apiKey) {
        const live = await fetchQuotesForSymbols({
          provider,
          apiKey,
          symbols: instruments.map((i) => i.symbol),
          debug: debugEnabled,
        })
        const map = new Map(live.map((q) => [q.symbol, q]))
        if (debugEnabled) {
          for (const l of live) {
            if (l.raw !== undefined) debugRawBySymbol[l.symbol] = l.raw
          }
        }
        quotes = mockQuotes.map((q) => {
          const l = map.get(q.symbol)
          // Guard: never replace fallback/mock values with invalid 0/negative prices.
          if (!l || !isValidPrice(l.price)) return q
          return {
            ...q,
            price: l.price,
            changePct: l.changePct ?? q.changePct,
            updatedAt: l.updatedAt ?? q.updatedAt,
          }
        })
      }

      // Crypto fallback: if the primary provider isn't configured or doesn't support our crypto symbols,
      // fill missing/invalid crypto prices using a free public endpoint (CoinGecko) with a static last resort.
      const cryptoSymbols = instruments.filter((i) => i.kind === 'crypto').map((i) => i.symbol)
      if (cryptoSymbols.length > 0) {
        const missingCrypto = quotes.filter((q) => q.kind === 'crypto' && !isValidPrice(q.price)).map((q) => q.symbol)
        if (missingCrypto.length > 0) {
          let cg = new Map<string, LiveLikeQuote>()
          try {
            cg = await fetchCoinGeckoUsdQuotes(missingCrypto)
          } catch {
            cg = new Map()
          }

          quotes = quotes.map((q) => {
            if (q.kind !== 'crypto') return q
            if (isValidPrice(q.price)) return q

            const fromCg = cg.get(q.symbol)
            if (fromCg && isValidPrice(fromCg.price)) {
              if (shouldLogOnce(hasLoggedFallback)) {
                logger.info({ level: 'info', scope: 'market', message: 'quotes.fallback', source: 'coingecko' })
                hasLoggedFallback = true
              }
              return {
                ...q,
                price: fromCg.price,
                changePct: typeof fromCg.changePct === 'number' ? fromCg.changePct : q.changePct,
                updatedAt: fromCg.updatedAt ?? q.updatedAt,
              }
            }

            const sample = sampleCryptoQuote(q.symbol)
            if (sample && isValidPrice(sample.price)) {
              if (shouldLogOnce(hasLoggedFallback)) {
                logger.info({ level: 'info', scope: 'market', message: 'quotes.fallback', source: 'sample' })
                hasLoggedFallback = true
              }
              return {
                ...q,
                price: sample.price,
                changePct: typeof sample.changePct === 'number' ? sample.changePct : q.changePct,
                updatedAt: sample.updatedAt ?? q.updatedAt,
              }
            }
            return q
          })
        }
      }

      // Best-effort logo lookup (Finnhub), cached in-memory.
      const finnhubKey = (env.FINNHUB_API_KEY ?? '').trim()
      if (finnhubKey) {
        const logos = await Promise.all(
          quotes.map(async (q) => {
            if (q.kind !== 'stock') return null
            return await getLogoUrl(q.symbol, finnhubKey)
          })
        )
        quotes = quotes.map((q, idx) => ({ ...q, logoUrl: logos[idx] }))
      }

      // Normalize final quote model so UI gets both canonical fields and backwards-compatible aliases.
      const normalized = quotes.map((q) =>
        toMarketQuote({
          symbol: q.symbol,
          kind: q.kind,
          price: q.price,
          changePct: q.changePct,
          updatedAt: q.updatedAt,
          logoUrl: q.logoUrl ?? null,
        })
      )

      cache.set(cacheKey, { at: now, quotes: normalized })
      if (debugEnabled) {
        const mappedBySymbol = Object.fromEntries(
          normalized.map((q) => [
            q.symbol,
            {
              symbol: q.symbol,
              kind: q.kind,
              lastPrice: q.lastPrice,
              changePercent: q.changePercent,
              updatedAt: q.updatedAt,
            },
          ])
        )
        return ok(
          {
            quotes: normalized,
            debug: {
              provider,
              rawBySymbol: debugRawBySymbol,
              mappedBySymbol,
            },
          },
          undefined,
          bridge,
          requestId
        )
      }
      return ok({ quotes: normalized }, undefined, bridge, requestId)
    } catch (err) {
      return asHttpError(err, '/api/market/quotes', undefined, bridge, requestId)
    }
  },
  { bodySchema: QuotesBodySchema }
)

