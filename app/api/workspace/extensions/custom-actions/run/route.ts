import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'
import { enqueueWebhookEventToEndpoint } from '@/lib/integrations/webhooks'
import { buildCustomActionPayload } from '@/lib/services/custom-actions'
import type { CustomActionRunContext } from '@/lib/extensions/types'
import type { CustomActionDefinition } from '@/lib/extensions/types'

export const dynamic = 'force-dynamic'

const RunSchema = z.object({
  actionId: z.string().uuid(),
  accountProgramId: z.string().uuid(),
})

type ActionDbRow = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  destination_type: string
  endpoint_id: string
  payload_template: unknown
  is_enabled: boolean
  created_by: string
  created_at: string
  updated_at: string
}

type ProgramAccountDbRow = {
  id: string
  lead_id: string | null
  account_name: string | null
  account_domain: string | null
  program_state: string | null
}

function normalizeAction(row: ActionDbRow): CustomActionDefinition {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    description: row.description,
    destination_type: 'webhook',
    endpoint_id: row.endpoint_id,
    payload_template: row.payload_template && typeof row.payload_template === 'object' ? (row.payload_template as Record<string, unknown>) : {},
    is_enabled: Boolean(row.is_enabled),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'extensions' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = RunSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      if (!policies.platform.extensionsEnabled) {
        return fail(ErrorCode.FORBIDDEN, 'Extensions disabled for this workspace', undefined, undefined, bridge, requestId)
      }

      const { data: actionRow } = await supabase
        .schema('api')
        .from('custom_actions')
        .select('id, workspace_id, name, description, destination_type, endpoint_id, payload_template, is_enabled, created_by, created_at, updated_at')
        .eq('workspace_id', ws.id)
        .eq('id', parsed.data.actionId)
        .maybeSingle()
      if (!actionRow) {
        return fail(ErrorCode.NOT_FOUND, 'Custom action not found', undefined, { status: 404 }, bridge, requestId)
      }
      const action = normalizeAction(actionRow as unknown as ActionDbRow)
      if (!action.is_enabled) {
        return fail(ErrorCode.NOT_FOUND, 'Custom action not found', undefined, { status: 404 }, bridge, requestId)
      }

      const { data: acct } = await supabase
        .schema('api')
        .from('account_program_accounts')
        .select('id, lead_id, account_name, account_domain, program_state')
        .eq('workspace_id', ws.id)
        .eq('id', parsed.data.accountProgramId)
        .maybeSingle()
      if (!acct) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)
      const acctRow = acct as unknown as ProgramAccountDbRow

      const ctx: CustomActionRunContext = {
        workspaceId: ws.id,
        account: {
          id: acctRow.id,
          lead_id: acctRow.lead_id ?? null,
          name: acctRow.account_name ?? null,
          domain: acctRow.account_domain ?? null,
          program_state: acctRow.program_state ?? 'standard',
        },
        computedAt: new Date().toISOString(),
      }

      const payload = buildCustomActionPayload({ action, ctx })
      const eventId = `custom_action:${parsed.data.actionId}:${parsed.data.accountProgramId}:${requestId}`
      const delivered = await enqueueWebhookEventToEndpoint({
        workspaceId: ws.id,
        endpointId: action.endpoint_id,
        eventType: 'custom.action.executed',
        eventId,
        payload: {
          object: 'custom_action_event',
          action: { id: parsed.data.actionId, name: action.name },
          context: ctx,
          payload,
          version: 'v1',
        },
      })

      await supabase.schema('api').from('action_deliveries').insert({
        workspace_id: ws.id,
        queue_item_id: null,
        actor_user_id: user.id,
        action_type: 'custom_action.executed',
        destination_type: 'webhook',
        destination_id: action.endpoint_id,
        status: delivered ? 'queued' : 'failed',
        webhook_delivery_id: delivered?.webhookDeliveryId ?? null,
        export_job_id: null,
        error: delivered ? null : 'Endpoint not configured for this event type',
        meta: { customActionId: parsed.data.actionId, accountProgramId: parsed.data.accountProgramId },
      })

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'custom_action.executed',
        targetType: 'custom_action',
        targetId: parsed.data.actionId,
        meta: { accountProgramId: parsed.data.accountProgramId, webhookDeliveryId: delivered?.webhookDeliveryId ?? null },
        request,
      })
      await logProductEvent({ userId: user.id, eventName: 'custom_action_executed', eventProps: { workspaceId: ws.id } })

      return ok({ ok: true, webhookDeliveryId: delivered?.webhookDeliveryId ?? null }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/workspace/extensions/custom-actions/run', userId, bridge, requestId)
    }
  },
  { bodySchema: RunSchema }
)

