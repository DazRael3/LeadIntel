import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { getUserTierForGating } from '@/lib/team/gating'
import { getAccountExplainability } from '@/lib/data/getAccountExplainability'
import { buildOutreachVariants } from '@/lib/services/outreach-variants'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional(),
  max_variants: z.number().int().min(1).max(10).optional(),
})

function extractAccountIdFromPath(pathname: string): string | null {
  // /api/accounts/[accountId]/actions/outreach-variants
  const parts = pathname.split('/').filter(Boolean)
  const accountId = parts.at(-3)
  return typeof accountId === 'string' && accountId.trim().length > 0 ? accountId : null
}

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      const accountId = extractAccountIdFromPath(new URL(request.url).pathname)
      if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

      // Premium surface: outreach variants require a paid tier (Closer or above).
      const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (tier === 'starter') {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const explainability = await getAccountExplainability({
        supabase,
        userId: user.id,
        accountId,
        window: parsed.data.window ?? '30d',
        type: null,
        sort: 'recent',
        limit: 80,
      })
      if (!explainability) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)

      const variants = buildOutreachVariants({
        companyName: explainability.account.name ?? 'Unknown company',
        personas: explainability.people?.personas ?? null,
        momentum: explainability.momentum ?? null,
        firstPartyIntent: explainability.firstPartyIntent ?? null,
        signals: explainability.signals ?? [],
        maxVariants: parsed.data.max_variants,
      })

      return ok({ variants }, undefined, bridge, requestId)
    } catch (err) {
      return asHttpError(err, '/api/accounts/[accountId]/actions/outreach-variants', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

