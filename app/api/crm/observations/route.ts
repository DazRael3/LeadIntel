import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { revenueIntelligenceEnabled } from '@/lib/services/revenue-governance'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const CreateObservationSchema = z.object({
  accountId: z.string().uuid(),
  opportunityMappingId: z.string().uuid().nullable().optional(),
  opportunityId: z.string().trim().min(1).max(128),
  crmSystem: z.enum(['generic']).default('generic'),
  stage: z.string().trim().min(1).max(64).nullable().optional(),
  status: z.string().trim().min(1).max(64).nullable().optional(),
  observedAt: z.string().trim().datetime().optional(),
  evidenceNote: z.string().trim().min(1).max(2000).nullable().optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = CreateObservationSchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      const enabled = revenueIntelligenceEnabled({ policies, role: membership.role })
      if (!enabled.ok) return fail(ErrorCode.FORBIDDEN, enabled.reason, undefined, undefined, bridge, requestId)

      // Enforce account access under leads RLS.
      const { data: lead } = await supabase.schema('api').from('leads').select('id').eq('id', parsed.data.accountId).maybeSingle()
      if (!lead) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, undefined, bridge, requestId)

      // If provided, ensure opportunity mapping exists in this workspace (best-effort).
      if (parsed.data.opportunityMappingId) {
        const { data: mapping } = await supabase
          .schema('api')
          .from('crm_object_mappings')
          .select('id, mapping_kind, account_id')
          .eq('workspace_id', ws.id)
          .eq('id', parsed.data.opportunityMappingId)
          .maybeSingle()
        const mk = (mapping as { mapping_kind?: unknown } | null)?.mapping_kind
        const accountId = (mapping as { account_id?: unknown } | null)?.account_id
        if (mk !== 'opportunity' || (typeof accountId === 'string' && accountId !== parsed.data.accountId)) {
          return fail(ErrorCode.VALIDATION_ERROR, 'Invalid opportunity mapping', undefined, { status: 400 }, bridge, requestId)
        }
      }

      const { data, error } = await supabase
        .schema('api')
        .from('crm_opportunity_observations')
        .insert({
          workspace_id: ws.id,
          account_id: parsed.data.accountId,
          opportunity_mapping_id: parsed.data.opportunityMappingId ?? null,
          crm_system: parsed.data.crmSystem,
          opportunity_id: parsed.data.opportunityId,
          stage: parsed.data.stage ?? null,
          status: parsed.data.status ?? null,
          observed_at: parsed.data.observedAt ?? new Date().toISOString(),
          source: 'manual',
          evidence_note: parsed.data.evidenceNote ?? null,
          meta: {},
          recorded_by: user.id,
        })
        .select('id')
        .single()

      if (error || !data) return fail(ErrorCode.INTERNAL_ERROR, 'Save failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'crm.opportunity_observed',
        targetType: 'lead',
        targetId: parsed.data.accountId,
        meta: { opportunityId: parsed.data.opportunityId },
        request,
      })

      await logProductEvent({
        userId: user.id,
        eventName: 'crm_opportunity_observed',
        eventProps: { workspaceId: ws.id, accountId: parsed.data.accountId },
      })

      return ok({ workspaceId: ws.id, observationId: (data as { id?: unknown } | null)?.id ?? null }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/crm/observations', userId, bridge, requestId)
    }
  },
  { bodySchema: CreateObservationSchema }
)

