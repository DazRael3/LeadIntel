import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { getPlan } from '@/lib/billing/plan'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const plan = await getPlan(supabase as any, user.id)
    return ok({ plan }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/plan', undefined, bridge, requestId)
  }
})
