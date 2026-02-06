import { NextRequest } from 'next/server'
import { z } from 'zod'

import { withApiGuard } from '@/lib/api/guard'
import { ok, asHttpError, createCookieBridge, fail, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { serverEnv } from '@/lib/env'
import { logger } from '@/lib/observability/logger'
import { getStarterPitchCapSummary, STARTER_PITCH_CAP_LIMIT } from '@/lib/billing/usage'

export const dynamic = 'force-dynamic'

type Tier = 'starter' | 'closer' | 'team'

const QuerySchema = z.object({})

function isActiveStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing'
}

function configuredCloserPriceId(): string | null {
  const v = (serverEnv.STRIPE_PRICE_ID_PRO || serverEnv.STRIPE_PRICE_ID || '').trim()
  return v.length > 0 ? v : null
}

export const GET = withApiGuard(
  async (request: NextRequest, { requestId }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      // Resolve tier using the same DB sources updated by Stripe webhook / verify route.
      let tier: Tier = 'starter'

      const { data: subRow } = await supabase
        .schema('api')
        .from('subscriptions')
        .select('status, stripe_price_id, price_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const status = (subRow as { status?: string | null } | null)?.status ?? null
      if (isActiveStatus(status)) {
        const closerPrice = configuredCloserPriceId()
        const subPrice =
          (subRow as { stripe_price_id?: string | null } | null)?.stripe_price_id ??
          (subRow as { price_id?: string | null } | null)?.price_id ??
          null
        if (closerPrice && typeof subPrice === 'string' && subPrice.length > 0 && subPrice !== closerPrice) tier = 'team'
        else tier = 'closer'
      } else {
        // Fallback: use the user row marker (e.g., immediately after checkout verification).
        const { data: userRow } = await supabase
          .schema('api')
          .from('users')
          .select('subscription_tier')
          .eq('id', user.id)
          .maybeSingle()
        const subTier = (userRow as { subscription_tier?: string | null } | null)?.subscription_tier ?? null
        if (subTier === 'pro') tier = 'closer'
      }

      let pitchesUsed = 0
      let pitchesLimit: number | null = null
      if (tier === 'starter') {
        const cap = await getStarterPitchCapSummary({ userId: user.id })
        pitchesUsed = cap.used
        pitchesLimit = STARTER_PITCH_CAP_LIMIT
      } else {
        pitchesUsed = 0
        pitchesLimit = null
      }

      logger.info({
        level: 'info',
        scope: 'usage',
        message: 'pitch.summary',
        userId: user.id,
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

