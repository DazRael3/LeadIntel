import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, createCookieBridge, asHttpError } from '@/lib/api/http'
import type { InstrumentDefinition, InstrumentKind } from '@/lib/market/instruments'
import type { InstrumentQuote } from '@/lib/market/prices'
import { generateMockInstrumentQuotes } from '@/lib/market/prices'
import { getServerEnv } from '@/lib/env'
import { fetchQuotesForSymbols } from '@/lib/market/liveProvider'

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
      if (provider && provider !== 'none' && apiKey) {
        const live = await fetchQuotesForSymbols({
          provider,
          apiKey,
          symbols: instruments.map((i) => i.symbol),
        })
        const map = new Map(live.map((q) => [q.symbol, q]))
        quotes = mockQuotes.map((q) => {
          const l = map.get(q.symbol)
          if (!l || l.price == null) return q
          return {
            ...q,
            price: l.price,
            changePct: l.changePct ?? q.changePct,
            updatedAt: l.updatedAt ?? q.updatedAt,
          }
        })
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

      cache.set(cacheKey, { at: now, quotes })
      return ok({ quotes }, undefined, bridge, requestId)
    } catch (err) {
      return asHttpError(err, '/api/market/quotes', undefined, bridge, requestId)
    }
  },
  { bodySchema: QuotesBodySchema }
)

