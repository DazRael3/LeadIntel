import { NextRequest } from 'next/server'
import { z } from 'zod'

import { withApiGuard } from '@/lib/api/guard'
import { ok, asHttpError, createCookieBridge, fail, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { logger } from '@/lib/observability/logger'
import { getStarterLeadCountFromDb, getStarterPitchCapSummary } from '@/lib/billing/usage'
import { STARTER_PITCH_CAP_LIMIT } from '@/lib/billing/constants'

export const dynamic = 'force-dynamic'

type Tier = 'starter' | 'closer'

const QuerySchema = z.object({})

function isActiveStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing'
}

export const GET = withApiGuard(
  async (request: NextRequest, { requestId, userId }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      // Auth is enforced by withApiGuard via lib/api/policy.ts (GET:/api/usage/pitch-summary authRequired: true).
      // This guard is defensive for unexpected misconfiguration.
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      // Resolve tier using the same DB sources updated by Stripe webhook / verify route.
      // Product spec: only Starter and Closer are exposed. Legacy "team" is treated as Closer.
      let tier: Tier = 'starter'

      const { data: subRow } = await supabase
        .schema('api')
        .from('subscriptions')
        .select('status, stripe_price_id, price_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const status = (subRow as { status?: string | null } | null)?.status ?? null
      if (isActiveStatus(status)) {
        tier = 'closer'
      } else {
        // Fallback: use the user row marker (e.g., immediately after checkout verification).
        const { data: userRow } = await supabase
          .schema('api')
          .from('users')
          .select('subscription_tier')
          .eq('id', userId)
          .maybeSingle()
        const subTier = (userRow as { subscription_tier?: string | null } | null)?.subscription_tier ?? null
        if (subTier === 'pro' || subTier === 'team' || subTier === 'closer') tier = 'closer'
      }

      let pitchesUsed = 0
      let pitchesLimit: number | null = null
      if (tier === 'starter') {
        const leadCount = await getStarterLeadCountFromDb(userId)
        const cap = await getStarterPitchCapSummary({ userId })
        const used = Math.max(Math.max(leadCount, 0), Math.max(cap.used, 0))
        // Best-effort: clamp to the starter credit cap.
        pitchesUsed = Math.min(used, STARTER_PITCH_CAP_LIMIT)
        pitchesLimit = STARTER_PITCH_CAP_LIMIT
      } else {
        pitchesUsed = 0
        pitchesLimit = null
      }

      logger.info({
        level: 'info',
        scope: 'usage',
        message: 'pitch.summary',
        userId,
        tier,
        pitchesUsed,
        pitchesLimit,
      })

      // Additional log line (keep existing one above intact).
      logger.info({
        level: 'info',
        scope: 'usage',
        message: 'pitch_summary',
        userId,
        tier,
        pitchesUsed,
        pitchesLimit,
      })

      return ok({ tier, pitchesUsed, pitchesLimit }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/usage/pitch-summary', undefined, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

