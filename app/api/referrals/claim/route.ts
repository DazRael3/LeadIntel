import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { claimReferralReward } from '@/lib/referrals/claim'

export const dynamic = 'force-dynamic'

const ReferralClaimSchema = z.object({
  referrerId: z.string().uuid('Invalid referrer id'),
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)

    try {
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }
      const user = await getUserSafe(supabase)
      if (!user) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const parsed = ReferralClaimSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      const result = await claimReferralReward({
        referredUserId: user.id,
        referrerId: parsed.data.referrerId,
      })

      if (!result.rewarded) {
        return fail(ErrorCode.CONFLICT, result.reason, undefined, { status: 409 }, bridge, requestId)
      }

      return ok({ claimed: true, bonusLeads: 10 }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/referrals/claim', userId ?? undefined, bridge, requestId)
    }
  },
  { bodySchema: ReferralClaimSchema }
)

