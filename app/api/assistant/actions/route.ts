import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { assistantActionsAllowed, assistantEnabledFor } from '@/lib/assistant/permissions'
import { prepareCrmHandoff } from '@/lib/services/crm-handoff'
import { prepareSequencerHandoff } from '@/lib/services/sequencer-handoff'
import { createActionQueueItem } from '@/lib/services/action-queue'
import { submitApprovalRequest } from '@/lib/services/approvals'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const Base = z.object({ confirm: z.boolean().optional().default(false) })

const PrepareCrm = Base.extend({
  kind: z.literal('prepare_crm_handoff'),
  accountId: z.string().uuid(),
  window: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
  mode: z.enum(['account_push', 'task', 'note']).default('task'),
})

const PrepareSequencer = Base.extend({
  kind: z.literal('prepare_sequencer_handoff'),
  accountId: z.string().uuid(),
  window: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
})

const AddToQueue = Base.extend({
  kind: z.literal('add_to_queue'),
  accountId: z.string().uuid(),
  reason: z.string().trim().min(1).max(240),
})

const RequestTemplateApproval = Base.extend({
  kind: z.literal('request_template_approval'),
  templateId: z.string().uuid(),
  note: z.string().trim().max(500).nullable().optional(),
})

const BodySchema = z.discriminatedUnion('kind', [PrepareCrm, PrepareSequencer, AddToQueue, RequestTemplateApproval])

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) {
        return fail(
          'ASSISTANT_PLAN_REQUIRED',
          'Upgrade required to use the Assistant.',
          { requiredPlan: 'team' },
          { status: 403 },
          bridge,
          requestId
        )
      }

      const parsed = BodySchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) {
        return fail(
          'ASSISTANT_WORKSPACE_REQUIRED',
          'Workspace setup required to use the Assistant.',
          { reason: 'workspace_missing' },
          { status: 422 },
          bridge,
          requestId
        )
      }

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) {
        return fail(
          'ASSISTANT_INSUFFICIENT_PERMISSIONS',
          'Insufficient permissions for this workspace.',
          { reason: 'workspace_membership_missing' },
          { status: 403 },
          bridge,
          requestId
        )
      }

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      const enabled = assistantEnabledFor({ policies, role: membership.role })
      if (!enabled.ok) {
        return fail('ASSISTANT_DISABLED', enabled.reason, { reason: 'assistant_disabled' }, { status: 403 }, bridge, requestId)
      }
      if (!assistantActionsAllowed({ policies, role: membership.role })) {
        return fail(
          'ASSISTANT_ACTIONS_FORBIDDEN',
          'Assistant actions are disabled or restricted for your role.',
          { reason: 'actions_forbidden' },
          { status: 403 },
          bridge,
          requestId
        )
      }

      // PREVIEW (no side effects unless confirm=true)
      if (parsed.data.kind === 'prepare_crm_handoff') {
        const { payload, companyName } = await prepareCrmHandoff({
          supabase,
          userId: user.id,
          accountId: parsed.data.accountId,
          window: parsed.data.window,
          mode: parsed.data.mode,
        })

        if (!parsed.data.confirm) {
          await logProductEvent({ userId: user.id, eventName: 'assistant_action_suggested', eventProps: { workspaceId: ws.id, kind: parsed.data.kind } })
          return ok({ kind: parsed.data.kind, preview: { companyName, payload }, requiresConfirmation: true }, undefined, bridge, requestId)
        }

        const { data: wsRow } = await supabase
          .schema('api')
          .from('workspaces')
          .select('default_handoff_webhook_endpoint_id')
          .eq('id', ws.id)
          .maybeSingle()
        const defaultEndpoint = (wsRow as { default_handoff_webhook_endpoint_id?: unknown } | null)?.default_handoff_webhook_endpoint_id
        const defaultEndpointId = typeof defaultEndpoint === 'string' ? defaultEndpoint : null

        const queueItem = await createActionQueueItem({
          supabase,
          workspaceId: ws.id,
          userId: user.id,
          leadId: parsed.data.accountId,
          actionType: 'crm_handoff_prepared',
          status: 'ready',
          destinationType: defaultEndpointId ? 'webhook' : null,
          destinationId: defaultEndpointId,
          reason: 'Prepared via assistant',
          payloadMeta: { kind: payload.kind, window: parsed.data.window, mode: payload.crm.mode, companyName, taskTitle: payload.crm.taskTitle, noteTitle: payload.crm.noteTitle },
        })

        await logAudit({
          supabase,
          workspaceId: ws.id,
          actorUserId: user.id,
          action: 'assistant.action.confirmed',
          targetType: 'lead',
          targetId: parsed.data.accountId,
          meta: { kind: parsed.data.kind, queueItemId: queueItem.id },
          request,
        })
        await logProductEvent({ userId: user.id, eventName: 'assistant_action_confirmed', eventProps: { workspaceId: ws.id, kind: parsed.data.kind } })
        return ok({ kind: parsed.data.kind, result: { queueItemId: queueItem.id, canDeliver: Boolean(defaultEndpointId) } }, undefined, bridge, requestId)
      }

      if (parsed.data.kind === 'prepare_sequencer_handoff') {
        const { payload, companyName } = await prepareSequencerHandoff({
          supabase,
          userId: user.id,
          accountId: parsed.data.accountId,
          window: parsed.data.window,
        })

        if (!parsed.data.confirm) {
          await logProductEvent({ userId: user.id, eventName: 'assistant_action_suggested', eventProps: { workspaceId: ws.id, kind: parsed.data.kind } })
          return ok({ kind: parsed.data.kind, preview: { companyName, payload }, requiresConfirmation: true }, undefined, bridge, requestId)
        }

        const { data: wsRow } = await supabase
          .schema('api')
          .from('workspaces')
          .select('default_handoff_webhook_endpoint_id')
          .eq('id', ws.id)
          .maybeSingle()
        const defaultEndpoint = (wsRow as { default_handoff_webhook_endpoint_id?: unknown } | null)?.default_handoff_webhook_endpoint_id
        const defaultEndpointId = typeof defaultEndpoint === 'string' ? defaultEndpoint : null

        const queueItem = await createActionQueueItem({
          supabase,
          workspaceId: ws.id,
          userId: user.id,
          leadId: parsed.data.accountId,
          actionType: 'sequencer_handoff_prepared',
          status: 'ready',
          destinationType: defaultEndpointId ? 'webhook' : null,
          destinationId: defaultEndpointId,
          reason: 'Prepared via assistant',
          payloadMeta: { kind: payload.kind, window: parsed.data.window, companyName, sequenceName: payload.sequencer.sequenceNameSuggestion, targetPersona: payload.sequencer.targetPersona },
        })

        await logAudit({
          supabase,
          workspaceId: ws.id,
          actorUserId: user.id,
          action: 'assistant.action.confirmed',
          targetType: 'lead',
          targetId: parsed.data.accountId,
          meta: { kind: parsed.data.kind, queueItemId: queueItem.id },
          request,
        })
        await logProductEvent({ userId: user.id, eventName: 'assistant_action_confirmed', eventProps: { workspaceId: ws.id, kind: parsed.data.kind } })
        return ok({ kind: parsed.data.kind, result: { queueItemId: queueItem.id, canDeliver: Boolean(defaultEndpointId) } }, undefined, bridge, requestId)
      }

      if (parsed.data.kind === 'add_to_queue') {
        if (!parsed.data.confirm) {
          await logProductEvent({ userId: user.id, eventName: 'assistant_action_suggested', eventProps: { workspaceId: ws.id, kind: parsed.data.kind } })
          return ok({ kind: parsed.data.kind, preview: { reason: parsed.data.reason }, requiresConfirmation: true }, undefined, bridge, requestId)
        }

        const queueItem = await createActionQueueItem({
          supabase,
          workspaceId: ws.id,
          userId: user.id,
          leadId: parsed.data.accountId,
          actionType: 'manual_review_required',
          status: 'manual_review',
          destinationType: null,
          destinationId: null,
          reason: parsed.data.reason,
          payloadMeta: { reason: parsed.data.reason },
        })

        await logAudit({
          supabase,
          workspaceId: ws.id,
          actorUserId: user.id,
          action: 'assistant.action.confirmed',
          targetType: 'lead',
          targetId: parsed.data.accountId,
          meta: { kind: parsed.data.kind, queueItemId: queueItem.id },
          request,
        })
        await logProductEvent({ userId: user.id, eventName: 'assistant_action_confirmed', eventProps: { workspaceId: ws.id, kind: parsed.data.kind } })
        return ok({ kind: parsed.data.kind, result: { queueItemId: queueItem.id } }, undefined, bridge, requestId)
      }

      if (parsed.data.kind === 'request_template_approval') {
        if (!parsed.data.confirm) {
          await logProductEvent({ userId: user.id, eventName: 'assistant_action_suggested', eventProps: { workspaceId: ws.id, kind: parsed.data.kind } })
          return ok({ kind: parsed.data.kind, preview: { note: parsed.data.note ?? null }, requiresConfirmation: true }, undefined, bridge, requestId)
        }

        const approval = await submitApprovalRequest({
          supabase,
          workspaceId: ws.id,
          actorUserId: user.id,
          targetType: 'template',
          targetId: parsed.data.templateId,
          note: parsed.data.note ?? null,
        })

        await logAudit({
          supabase,
          workspaceId: ws.id,
          actorUserId: user.id,
          action: 'assistant.action.confirmed',
          targetType: 'template',
          targetId: parsed.data.templateId,
          meta: { kind: parsed.data.kind, approvalId: approval.id },
          request,
        })
        await logProductEvent({ userId: user.id, eventName: 'assistant_action_confirmed', eventProps: { workspaceId: ws.id, kind: parsed.data.kind } })
        return ok({ kind: parsed.data.kind, result: { approvalId: approval.id } }, undefined, bridge, requestId)
      }

      return fail(ErrorCode.INTERNAL_ERROR, 'Unsupported action', undefined, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/assistant/actions', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

