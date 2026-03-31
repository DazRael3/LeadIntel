import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(10).max(200).optional().default(50),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId, query }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'platform_api_access' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const parsed = QuerySchema.safeParse(query ?? {})
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    if (!policies.platform.apiAccessEnabled) {
      return ok({ workspaceId: ws.id, apiAccessEnabled: false, logs: [] }, undefined, bridge, requestId)
    }
    if (!policies.platform.apiKeyManageRoles.includes(membership.role)) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    const { data: logs } = await supabase
      .schema('api')
      .from('api_request_logs')
      .select('id, api_key_id, method, route, status, error_code, latency_ms, created_at')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: false })
      .limit(parsed.data.limit)

    await logProductEvent({ userId: user.id, eventName: 'api_usage_viewed', eventProps: { workspaceId: ws.id } })

    return ok({ workspaceId: ws.id, apiAccessEnabled: true, logs: logs ?? [] }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/platform/usage', userId, bridge, requestId)
  }
})

