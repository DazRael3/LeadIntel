import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { SOURCE_REGISTRY } from '@/lib/sources/registry'
import { getSourceRuntimeStatus } from '@/lib/services/source-catalog'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'team_settings' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const runtime = getSourceRuntimeStatus()

    await logProductEvent({ userId: user.id, eventName: 'source_catalog_viewed', eventProps: { count: SOURCE_REGISTRY.length } })

    return ok({ sources: SOURCE_REGISTRY, runtime }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/settings/sources', userId, bridge, requestId)
  }
})

