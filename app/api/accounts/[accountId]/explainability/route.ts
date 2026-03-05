import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getAccountExplainability } from '@/lib/data/getAccountExplainability'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional(),
  type: z.string().trim().min(1).max(64).optional(),
  sort: z.enum(['recent', 'confidence']).optional(),
  limit: z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      if (!v) return undefined
      const n = Number.parseInt(v, 10)
      return Number.isFinite(n) ? n : undefined
    }),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  try {
    if (!userId) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const url = new URL(request.url)
    const pathnameParts = url.pathname.split('/').filter(Boolean)
    const accountId = pathnameParts.at(-2) // /api/accounts/[accountId]/explainability
    if (!accountId) {
      return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)
    }

    const parsed = QuerySchema.safeParse({
      window: url.searchParams.get('window') ?? undefined,
      type: url.searchParams.get('type') ?? undefined,
      sort: url.searchParams.get('sort') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return fail(ErrorCode.VALIDATION_ERROR, 'Invalid query params', parsed.error.flatten(), { status: 400 }, bridge, requestId)
    }

    const supabase = createRouteClient(request, bridge)
    const explainability = await getAccountExplainability({
      supabase,
      userId,
      accountId,
      window: parsed.data.window,
      type: parsed.data.type ?? null,
      sort: parsed.data.sort,
      limit: parsed.data.limit,
    })

    if (!explainability) {
      return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)
    }

    return ok(explainability, undefined, bridge, requestId)
  } catch (err) {
    return asHttpError(err, '/api/accounts/[accountId]/explainability', userId, bridge, requestId)
  }
})

