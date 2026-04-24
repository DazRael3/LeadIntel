import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import {
  clearDemoHandoffCookieOnResponse,
  claimDemoHandoffFromRequest,
} from '@/lib/demo/claim'

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

    const claim = await claimDemoHandoffFromRequest({
      request,
      userId: user.id,
      supabase,
    })
    const response = ok({ claimed: Boolean(claim.claimedLeadId), ...claim }, undefined, bridge, requestId)

    // Clear handoff cookie after any claim attempt to avoid repeated stale checks.
    clearDemoHandoffCookieOnResponse(response)
    return response
  } catch (error) {
    return asHttpError(error, '/api/demo/claim', userId ?? undefined, bridge, requestId)
  }
})
