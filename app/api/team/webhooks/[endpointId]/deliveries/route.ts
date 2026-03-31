import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'integration_delivery_audit' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) {
      return ok({ deliveries: [] }, undefined, bridge, requestId)
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const parts = new URL(request.url).pathname.split('/')
    const endpointId = parts[parts.length - 2] || ''
    if (!endpointId) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', { endpointId: 'Missing endpoint id' }, undefined, bridge, requestId)

    // Ensure endpoint belongs to workspace (RLS allows members to select endpoints).
    const { data: endpoint } = await supabase
      .schema('api')
      .from('webhook_endpoints')
      .select('id, workspace_id')
      .eq('id', endpointId)
      .eq('workspace_id', workspace.id)
      .maybeSingle()

    if (!endpoint) return fail(ErrorCode.NOT_FOUND, 'Not found', undefined, { status: 404 }, bridge, requestId)

    const { data: deliveries, error } = await supabase
      .schema('api')
      .from('webhook_deliveries')
      .select('id, endpoint_id, event_type, event_id, status, attempts, next_attempt_at, last_status, last_error, created_at, updated_at')
      .eq('endpoint_id', endpointId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return fail(ErrorCode.DATABASE_ERROR, 'Failed to load deliveries', undefined, undefined, bridge, requestId)

    return ok({ deliveries: deliveries ?? [] }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/team/webhooks/[endpointId]/deliveries', userId, bridge, requestId)
  }
})

