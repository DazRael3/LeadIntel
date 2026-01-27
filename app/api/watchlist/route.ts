import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { isPro as isProPlan } from '@/lib/billing/plan'

const InstrumentTypeSchema = z.enum(['stock', 'crypto'])

const WatchlistItemSchema = z.object({
  symbol: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => /^[A-Z0-9.]{1,15}$/.test(s), 'Invalid symbol'),
  instrumentType: InstrumentTypeSchema,
})

const PutWatchlistSchema = z.object({
  items: z.array(WatchlistItemSchema).max(100),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  try {
    if (!userId) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const supabase = createRouteClient(request, bridge)
    const { data, error } = await supabase
      .from('watchlist_symbols')
      .select('symbol, instrument_type, position')
      .eq('user_id', userId)
      .order('position', { ascending: true })

    if (error) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to load watchlist', undefined, undefined, bridge, requestId)
    }

    const items =
      (data ?? []).map((row) => ({
        symbol: (row as { symbol: string }).symbol,
        instrumentType: (row as { instrument_type: 'stock' | 'crypto' }).instrument_type,
        position: (row as { position: number }).position,
      })) ?? []

    return ok({ items }, undefined, bridge, requestId)
  } catch (err) {
    return asHttpError(err, '/api/watchlist', undefined, bridge, requestId)
  }
})

export const PUT = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const supabase = createRouteClient(request, bridge)
      const allowed = await isProPlan(supabase, userId)
      if (!allowed) {
        return fail(ErrorCode.FORBIDDEN, 'Pro subscription required to customize watchlist', undefined, undefined, bridge, requestId)
      }

      const parsed = body as z.infer<typeof PutWatchlistSchema>
      const items = parsed.items

      // Replace in bulk (simple + deterministic).
      const { error: delError } = await supabase.from('watchlist_symbols').delete().eq('user_id', userId)
      if (delError) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to update watchlist', undefined, undefined, bridge, requestId)
      }

      if (items.length > 0) {
        const rows = items.map((it, idx) => ({
          user_id: userId,
          symbol: it.symbol,
          instrument_type: it.instrumentType,
          position: idx,
        }))
        const { error: insError } = await supabase.from('watchlist_symbols').insert(rows)
        if (insError) {
          return fail(ErrorCode.DATABASE_ERROR, 'Failed to update watchlist', undefined, undefined, bridge, requestId)
        }
      }

      return ok({ items: items.map((it, idx) => ({ ...it, position: idx })) }, undefined, bridge, requestId)
    } catch (err) {
      return asHttpError(err, '/api/watchlist', undefined, bridge, requestId)
    }
  },
  { bodySchema: PutWatchlistSchema }
)

