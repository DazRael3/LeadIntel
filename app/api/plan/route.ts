import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { getPlan } from '@/lib/billing/plan'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    const plan = await getPlan(supabase as any, user.id)
    return ok({ plan }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/plan', undefined, bridge)
  }
}
