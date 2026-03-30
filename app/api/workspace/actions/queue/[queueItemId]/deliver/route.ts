import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { enqueueWebhookEventToEndpoint, type WebhookEventType } from '@/lib/integrations/webhooks'
import { prepareCrmHandoff } from '@/lib/services/crm-handoff'
import { prepareSequencerHandoff } from '@/lib/services/sequencer-handoff'
import { buildWebhookDeliveryPayload, isSupportedWebhookDeliveryEventType } from '@/lib/services/integration-actions'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

function extractQueueItemIdFromPath(pathname: string): string | null {
  // /api/workspace/actions/queue/[queueItemId]/deliver
  const parts = pathname.split('/').filter(Boolean)
  const id = parts.at(-2)
  return typeof id === 'string' && id.trim().length > 0 ? id : null
}

type DbQueueRow = {
  id: string
  workspace_id: string
  created_by: string
  lead_id: string | null
  action_type: string
  status: string
  destination_type: string | null
  destination_id: string | null
  payload_meta: unknown
}

function getMetaString(meta: Record<string, unknown>, key: string): string | null {
  const v = meta[key]
  return typeof v === 'string' && v.trim().length > 0 ? v : null
}

export const POST = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  const admin = createSupabaseAdminClient({ schema: 'api' })
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const queueItemId = extractQueueItemIdFromPath(new URL(request.url).pathname)
    if (!queueItemId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing queue item id', undefined, { status: 400 }, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { data: queueRow } = await supabase
      .schema('api')
      .from('action_queue_items')
      .select('id, workspace_id, created_by, lead_id, action_type, status, destination_type, destination_id, payload_meta')
      .eq('id', queueItemId)
      .maybeSingle()

    const row = queueRow as unknown as DbQueueRow | null
    if (!row || row.workspace_id !== workspace.id) return fail(ErrorCode.NOT_FOUND, 'Not found', undefined, { status: 404 }, bridge, requestId)
    if (row.status !== 'ready' && row.status !== 'failed' && row.status !== 'blocked') {
      return fail(ErrorCode.CONFLICT, 'This action is still processing', undefined, { status: 409 }, bridge, requestId)
    }

    const meta = (row.payload_meta && typeof row.payload_meta === 'object' ? (row.payload_meta as Record<string, unknown>) : {}) as Record<
      string,
      unknown
    >
    const window = (getMetaString(meta, 'window') as '7d' | '30d' | '90d' | 'all' | null) ?? '30d'

    const { data: ws } = await supabase
      .schema('api')
      .from('workspaces')
      .select('default_handoff_webhook_endpoint_id')
      .eq('id', workspace.id)
      .maybeSingle()
    const defaultEndpoint = (ws as { default_handoff_webhook_endpoint_id?: unknown } | null)?.default_handoff_webhook_endpoint_id
    const defaultEndpointId = typeof defaultEndpoint === 'string' ? defaultEndpoint : null

    const endpointId = (row.destination_type === 'webhook' ? row.destination_id : null) ?? defaultEndpointId
    if (!endpointId) {
      return fail(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Destination not configured',
        { destination: 'Set a default handoff webhook destination in workspace integrations.' },
        { status: 424 },
        bridge,
        requestId
      )
    }

    let eventType: WebhookEventType
    let actionEvent: 'crm_handoff_delivered' | 'sequencer_handoff_delivered' | null = null
    let actionTypeForHistory: 'crm_handoff' | 'sequencer_handoff' | 'webhook_delivery'
    let payload: Record<string, unknown>
    let auditTarget: { targetType: 'lead' | 'report'; targetId: string | null } = { targetType: 'lead', targetId: row.lead_id }

    if (row.action_type === 'crm_handoff_prepared') {
      if (!row.lead_id) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account', undefined, { status: 400 }, bridge, requestId)
      const modeRaw = getMetaString(meta, 'mode')
      const mode = modeRaw === 'account_push' || modeRaw === 'task' || modeRaw === 'note' ? modeRaw : 'task'
      const prepared = await prepareCrmHandoff({
        supabase,
        userId: user.id,
        accountId: row.lead_id,
        window,
        mode,
      })
      payload = prepared.payload as unknown as Record<string, unknown>
      eventType = 'handoff.crm.delivered'
      actionEvent = 'crm_handoff_delivered'
      actionTypeForHistory = 'crm_handoff'
    } else if (row.action_type === 'sequencer_handoff_prepared') {
      if (!row.lead_id) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account', undefined, { status: 400 }, bridge, requestId)
      const prepared = await prepareSequencerHandoff({ supabase, userId: user.id, accountId: row.lead_id, window })
      payload = prepared.payload as unknown as Record<string, unknown>
      eventType = 'handoff.sequencer.delivered'
      actionEvent = 'sequencer_handoff_delivered'
      actionTypeForHistory = 'sequencer_handoff'
    } else if (row.action_type === 'webhook_delivery') {
      const ev = getMetaString(meta, 'eventType')
      if (!isSupportedWebhookDeliveryEventType(ev)) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Unsupported webhook event', undefined, { status: 400 }, bridge, requestId)
      }
      const built = buildWebhookDeliveryPayload({ eventType: ev, leadId: row.lead_id, meta })
      eventType = built.eventType
      actionTypeForHistory = 'webhook_delivery'
      auditTarget = built.auditTarget
      payload = built.payload
    } else {
      return fail(ErrorCode.VALIDATION_ERROR, 'Unsupported action type', undefined, { status: 400 }, bridge, requestId)
    }

    const eventId = queueItemId
    const enq = await enqueueWebhookEventToEndpoint({
      workspaceId: workspace.id,
      endpointId,
      eventType,
      eventId,
      payload,
    })
    if (!enq) {
      return fail(
        ErrorCode.SERVICE_UNAVAILABLE,
        'Destination not ready',
        { destination: 'Webhook endpoint is disabled or not subscribed to this event type.' },
        { status: 424 },
        bridge,
        requestId
      )
    }

    const { data: delivery } = await admin
      .from('action_deliveries')
      .insert({
        workspace_id: workspace.id,
        queue_item_id: queueItemId,
        actor_user_id: user.id,
        action_type: actionTypeForHistory,
        destination_type: 'webhook',
        destination_id: endpointId,
        status: 'queued',
        webhook_delivery_id: enq.webhookDeliveryId,
        export_job_id: null,
        error: null,
        meta: { leadId: row.lead_id },
      })
      .select('id')
      .single()

    await admin
      .from('action_queue_items')
      .update({ status: 'queued', destination_type: 'webhook', destination_id: endpointId, error: null })
      .eq('id', queueItemId)
      .eq('workspace_id', workspace.id)

    await logAudit({
      supabase,
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: eventType,
      targetType: auditTarget.targetType,
      targetId: auditTarget.targetId,
      meta: { queueItemId, webhookDeliveryId: enq.webhookDeliveryId, actionDeliveryId: (delivery as { id?: unknown } | null)?.id ?? null },
      request,
    })

    if (actionEvent) {
      await logProductEvent({
        userId: user.id,
        eventName: actionEvent,
        eventProps: { workspaceId: workspace.id, accountId: row.lead_id, queueItemId, webhookDeliveryId: enq.webhookDeliveryId },
      })
    }

    return ok({ queued: true, webhookDeliveryId: enq.webhookDeliveryId }, { status: 202 }, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/workspace/actions/queue/[queueItemId]/deliver', userId, bridge, requestId)
  }
})

