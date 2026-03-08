import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getAccountExplainability } from '@/lib/data/getAccountExplainability'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional(),
})

function extractAccountIdFromPath(pathname: string): string | null {
  // /api/accounts/[accountId]/intent
  const parts = pathname.split('/').filter(Boolean)
  const accountId = parts.at(-2)
  return typeof accountId === 'string' && accountId.trim().length > 0 ? accountId : null
}

export const GET = withApiGuard(
  async (request: NextRequest, { requestId, userId, query }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const accountId = extractAccountIdFromPath(new URL(request.url).pathname)
      if (!accountId) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)
      }

      const q = query as z.infer<typeof QuerySchema>
      const supabase = createRouteClient(request, bridge)
      const explainability = await getAccountExplainability({
        supabase,
        userId,
        accountId,
        window: q.window ?? '30d',
        type: null,
        sort: 'recent',
        limit: 50,
      })

      if (!explainability) {
        return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)
      }

      return ok(explainability.firstPartyIntent, undefined, bridge, requestId)
    } catch (err) {
      return asHttpError(err, '/api/accounts/[accountId]/intent', userId, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

