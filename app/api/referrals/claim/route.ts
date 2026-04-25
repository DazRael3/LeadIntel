import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { claimReferralForUser } from '@/lib/referrals/claim'

export const dynamic = 'force-dynamic'

export const POST = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
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

    const payload = (await request.json().catch(() => null)) as { referrerId?: unknown; source?: unknown } | null
    const referrerId = typeof payload?.referrerId === 'string' ? payload.referrerId.trim() : ''
    const source = typeof payload?.source === 'string' ? payload.source.trim() : 'unknown'
    if (!referrerId) {
      return fail(ErrorCode.VALIDATION_ERROR, 'Referrer id is required', undefined, undefined, bridge, requestId)
    }

    const result = await claimReferralForUser({
      supabase,
      userId: user.id,
      referrerId,
      source,
    })

    if (!result.ok) {
      return fail(ErrorCode.CONFLICT, result.reason, undefined, { status: 409 }, bridge, requestId)
    }

    return ok({ claimed: true, bonusLeads: result.bonusLeads }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/referrals/claim', userId ?? undefined, bridge, requestId)
  }
})

