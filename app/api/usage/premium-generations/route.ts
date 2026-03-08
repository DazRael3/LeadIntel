import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { getPremiumGenerationCapabilities, getPremiumGenerationUsage } from '@/lib/billing/premium-generations'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const supabase = createRouteClient(request, bridge)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const [capabilities, usage] = await Promise.all([
      getPremiumGenerationCapabilities({ supabase, userId: user.id, sessionEmail: user.email ?? null }),
      getPremiumGenerationUsage({ supabase, userId: user.id }),
    ])

    return ok({ capabilities, usage }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/usage/premium-generations', userId, bridge, requestId)
  }
})

