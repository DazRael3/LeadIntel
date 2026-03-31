import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { revenueIntelligenceEnabled } from '@/lib/services/revenue-governance'
import { listCrmMappings, upsertCrmMapping, UpsertCrmMappingSchema } from '@/lib/services/crm-object-mapping'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'revenue_intelligence' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const url = new URL(request.url)
    const accountId = url.searchParams.get('accountId')

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    const enabled = revenueIntelligenceEnabled({ policies, role: membership.role })
    if (!enabled.ok) return fail(ErrorCode.FORBIDDEN, enabled.reason, undefined, undefined, bridge, requestId)

    const mappings = await listCrmMappings({ supabase, workspaceId: ws.id, ...(accountId ? { accountId } : {}) })
    return ok({ workspaceId: ws.id, mappings }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/crm/mappings', userId, bridge, requestId)
  }
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'revenue_intelligence' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      const enabled = revenueIntelligenceEnabled({ policies, role: membership.role })
      if (!enabled.ok) return fail(ErrorCode.FORBIDDEN, enabled.reason, undefined, undefined, bridge, requestId)

      const parsed = UpsertCrmMappingSchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      // Enforce account access under RLS (avoid mapping accounts the caller cannot see).
      if (parsed.data.accountId) {
        const { data: lead } = await supabase.schema('api').from('leads').select('id').eq('id', parsed.data.accountId).maybeSingle()
        if (!lead) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, undefined, bridge, requestId)
      }

      const mapping = await upsertCrmMapping({ supabase, workspaceId: ws.id, actorUserId: user.id, input: parsed.data })

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'crm.mapping_upserted',
        targetType: 'workspace',
        targetId: ws.id,
        meta: { mappingKind: mapping.mappingKind, crmSystem: mapping.crmSystem, accountId: mapping.accountId },
        request,
      })

      await logProductEvent({
        userId: user.id,
        eventName: 'crm_mapping_updated',
        eventProps: { workspaceId: ws.id, mappingKind: mapping.mappingKind, accountId: mapping.accountId },
      })

      return ok({ workspaceId: ws.id, mapping }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/crm/mappings', userId, bridge, requestId)
    }
  },
  { bodySchema: UpsertCrmMappingSchema }
)

