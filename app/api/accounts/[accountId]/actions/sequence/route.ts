import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { prepareSequencerHandoff } from '@/lib/services/sequencer-handoff'
import { createActionQueueItem } from '@/lib/services/action-queue'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional(),
})

function extractAccountIdFromPath(pathname: string): string | null {
  // /api/accounts/[accountId]/actions/sequence
  const parts = pathname.split('/').filter(Boolean)
  const accountId = parts.at(-3)
  return typeof accountId === 'string' && accountId.trim().length > 0 ? accountId : null
}

function truncateText(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return t.slice(0, Math.max(0, max - 3)) + '...'
}

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      const accountId = extractAccountIdFromPath(new URL(request.url).pathname)
      if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'account_intelligence' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { payload, companyName, benchmarkMeta } = await prepareSequencerHandoff({
        supabase,
        userId: user.id,
        accountId,
        window: parsed.data.window ?? '30d',
      })

      const { data: ws } = await supabase
        .schema('api')
        .from('workspaces')
        .select('default_handoff_webhook_endpoint_id')
        .eq('id', workspace.id)
        .maybeSingle()
      const defaultEndpoint = (ws as { default_handoff_webhook_endpoint_id?: unknown } | null)?.default_handoff_webhook_endpoint_id
      const defaultEndpointId = typeof defaultEndpoint === 'string' ? defaultEndpoint : null

      const queueItem = await createActionQueueItem({
        supabase,
        workspaceId: workspace.id,
        userId: user.id,
        leadId: accountId,
        actionType: 'sequencer_handoff_prepared',
        status: 'ready',
        destinationType: defaultEndpointId ? 'webhook' : null,
        destinationId: defaultEndpointId,
        reason: 'Prepared from account action center',
        payloadMeta: {
          kind: payload.kind,
          window: parsed.data.window ?? '30d',
          companyName,
          sequenceNameSuggestion: payload.sequencer.sequenceNameSuggestion,
          targetPersona: payload.sequencer.targetPersona,
          openerPreview: payload.sequencer.opener ? truncateText(payload.sequencer.opener, 220) : null,
          followupAngle: payload.sequencer.followupAngle,
          internalNote: payload.sequencer.internalNote,
          limitationsNote: payload.sequencer.limitationsNote,
          quality: payload.quality.dataQuality,
          patternBucket: benchmarkMeta.patternBucket,
          playbookSlug: benchmarkMeta.playbookSlug,
        },
      })

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'handoff.sequencer.prepared',
        targetType: 'lead',
        targetId: accountId,
        meta: {
          queueItemId: queueItem.id,
          destination: defaultEndpointId ? 'webhook' : 'none',
        },
        request,
      })

      await logProductEvent({
        userId: user.id,
        eventName: 'sequencer_handoff_prepared',
        eventProps: {
          workspaceId: workspace.id,
          accountId,
          hasDefaultDestination: Boolean(defaultEndpointId),
        },
      })

      return ok(
        {
          queueItemId: queueItem.id,
          canDeliver: Boolean(defaultEndpointId),
          payloadPreview: payload,
        },
        undefined,
        bridge,
        requestId
      )
    } catch (error) {
      return asHttpError(error, '/api/accounts/[accountId]/actions/sequence', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

