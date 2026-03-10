import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { runWebhookDeliveries } from '@/lib/integrations/webhooks'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

export const POST = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    const parts = new URL(request.url).pathname.split('/')
    const endpointId = parts[parts.length - 2] || ''
    if (!endpointId) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', { endpointId: 'Missing endpoint id' }, undefined, bridge, requestId)

    // Verify endpoint belongs to workspace via RLS.
    const { data: endpoint } = await supabase
      .schema('api')
      .from('webhook_endpoints')
      .select('id, workspace_id')
      .eq('id', endpointId)
      .eq('workspace_id', workspace.id)
      .maybeSingle()

    if (!endpoint) return fail(ErrorCode.NOT_FOUND, 'Not found', undefined, { status: 404 }, bridge, requestId)

    const admin = createSupabaseAdminClient({ schema: 'api' })
    const eventId = randomUUID()
    await admin.from('webhook_deliveries').insert({
      endpoint_id: endpointId,
      event_type: 'webhook.test',
      event_id: eventId,
      payload: {
        ok: true,
        event: 'webhook.test',
        eventId,
        workspaceId: workspace.id,
        createdAt: new Date().toISOString(),
      },
      status: 'pending',
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
    })

    const result = await runWebhookDeliveries({ limit: 10 })

    await logAudit({
      supabase,
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: 'webhook.test_sent',
      targetType: 'webhook_endpoint',
      targetId: endpointId,
      meta: { processed: result.processed, sent: result.sent, failed: result.failed },
      request,
    })

    return ok({ result }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/team/webhooks/[endpointId]/test', userId, bridge, requestId)
  }
})

