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

      cache.set(cacheKey, { at: now, quotes })
      return ok({ quotes }, undefined, bridge, requestId)
    } catch (err) {
      return asHttpError(err, '/api/market/quotes', undefined, bridge, requestId)
    }
  },
  { bodySchema: QuotesBodySchema }
)

