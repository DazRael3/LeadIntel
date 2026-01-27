import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { getPlanDetails } from '@/lib/billing/plan'
import { addInstrumentToWatchlist, getUserWatchlist, removeInstrumentFromWatchlist } from '@/lib/services/watchlist'

const InstrumentKindSchema = z.enum(['stock', 'crypto'])

const WatchlistModifySchema = z.object({
  symbol: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => /^[A-Z0-9.\-]{1,15}$/.test(s), 'Invalid symbol'),
  kind: InstrumentKindSchema,
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  try {
    if (!userId) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const supabase = createRouteClient(request, bridge)
    // Free users: watchlist is effectively disabled (they see defaults client-side).
    const plan = await getPlanDetails(supabase as unknown as Parameters<typeof getPlanDetails>[0], userId)
    if (plan.plan !== 'pro') {
      return ok({ items: [] }, undefined, bridge, requestId)
    }

    const items = await getUserWatchlist(supabase, userId)
    return ok({ items }, undefined, bridge, requestId)
  } catch (err) {
    return asHttpError(err, '/api/watchlist', undefined, bridge, requestId)
  }
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const supabase = createRouteClient(request, bridge)
      const plan = await getPlanDetails(supabase as unknown as Parameters<typeof getPlanDetails>[0], userId)
      if (plan.plan !== 'pro') {
        return fail(ErrorCode.FORBIDDEN, 'Pro subscription required to customize watchlist', undefined, undefined, bridge, requestId)
      }

      const parsed = body as z.infer<typeof WatchlistModifySchema>
      const result = await addInstrumentToWatchlist(supabase, userId, parsed)
      if (!result.ok) {
        return fail(ErrorCode.VALIDATION_ERROR, result.message, undefined, undefined, bridge, requestId)
      }

      const items = await getUserWatchlist(supabase, userId)
      return ok({ items }, undefined, bridge, requestId)
    } catch (err) {
      return asHttpError(err, '/api/watchlist', undefined, bridge, requestId)
    }
  },
  { bodySchema: WatchlistModifySchema }
)

export const DELETE = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const supabase = createRouteClient(request, bridge)
      const plan = await getPlanDetails(supabase as unknown as Parameters<typeof getPlanDetails>[0], userId)
      if (plan.plan !== 'pro') {
        return fail(ErrorCode.FORBIDDEN, 'Pro subscription required to customize watchlist', undefined, undefined, bridge, requestId)
      }

      // Allow either body or query params.
      const url = new URL(request.url)
      const symbolParam = url.searchParams.get('symbol')
      const kindParam = url.searchParams.get('kind')

      const parsed = (body ?? { symbol: symbolParam, kind: kindParam }) as unknown
      const v = WatchlistModifySchema.safeParse(parsed)
      if (!v.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', v.error, undefined, bridge, requestId)
      }

      const result = await removeInstrumentFromWatchlist(supabase, userId, v.data)
      if (!result.ok) {
        return fail(ErrorCode.VALIDATION_ERROR, result.message, undefined, undefined, bridge, requestId)
      }

      const items = await getUserWatchlist(supabase, userId)
      return ok({ items }, undefined, bridge, requestId)
    } catch (err) {
      return asHttpError(err, '/api/watchlist', undefined, bridge, requestId)
    }
  },
  { bodySchema: WatchlistModifySchema.partial() }
)

