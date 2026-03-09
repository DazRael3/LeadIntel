import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { revenueIntelligenceEnabled } from '@/lib/services/revenue-governance'
import { getCrmLinkageHealth } from '@/lib/services/crm-linkage-health'
import { listVerificationReviews } from '@/lib/services/outcome-verification'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

type LeadRow = { id: string; company_name: string | null; company_domain: string | null; created_at: string }

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    const enabled = revenueIntelligenceEnabled({ policies, role: membership.role })
    if (!enabled.ok) return fail(ErrorCode.FORBIDDEN, enabled.reason, undefined, undefined, bridge, requestId)

    const { data: leads } = await supabase
      .schema('api')
      .from('leads')
      .select('id, company_name, company_domain, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(25)

    const rows = (leads ?? []) as unknown as LeadRow[]
    const accountIds = rows.map((r) => r.id)

    const [health, reviews, { data: mappings }, { data: observations }] = await Promise.all([
      getCrmLinkageHealth({ supabase, workspaceId: ws.id }),
      listVerificationReviews({ supabase, workspaceId: ws.id, limit: 25 }),
      accountIds.length > 0
        ? supabase
            .schema('api')
            .from('crm_object_mappings')
            .select('id, account_id, mapping_kind, verification_status, updated_at')
            .eq('workspace_id', ws.id)
            .in('account_id', accountIds)
            .limit(200)
        : Promise.resolve({ data: [] as unknown[] }),
      accountIds.length > 0
        ? supabase
            .schema('api')
            .from('crm_opportunity_observations')
            .select('id, account_id, opportunity_id, stage, status, observed_at')
            .eq('workspace_id', ws.id)
            .in('account_id', accountIds)
            .order('observed_at', { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] as unknown[] }),
    ])

    const mappingByAccount = new Map<string, { verification_status: string; updated_at: string }>()
    for (const m of (mappings ?? []) as Array<{ account_id?: unknown; mapping_kind?: unknown; verification_status?: unknown; updated_at?: unknown }>) {
      if (m.mapping_kind !== 'account') continue
      const id = typeof m.account_id === 'string' ? m.account_id : null
      if (!id) continue
      const existing = mappingByAccount.get(id)
      const updatedAt = typeof m.updated_at === 'string' ? m.updated_at : ''
      if (!existing || Date.parse(updatedAt) > Date.parse(existing.updated_at)) {
        mappingByAccount.set(id, { verification_status: typeof m.verification_status === 'string' ? m.verification_status : 'unverified', updated_at: updatedAt })
      }
    }

    const latestObsByAccount = new Map<string, { observed_at: string; stage: string | null; status: string | null }>()
    for (const o of (observations ?? []) as Array<{ account_id?: unknown; observed_at?: unknown; stage?: unknown; status?: unknown }>) {
      const id = typeof o.account_id === 'string' ? o.account_id : null
      const at = typeof o.observed_at === 'string' ? o.observed_at : null
      if (!id || !at) continue
      if (!latestObsByAccount.has(id)) {
        latestObsByAccount.set(id, {
          observed_at: at,
          stage: typeof o.stage === 'string' ? o.stage : null,
          status: typeof o.status === 'string' ? o.status : null,
        })
      }
    }

    const accounts = rows.map((r) => {
      const map = mappingByAccount.get(r.id) ?? null
      const obs = latestObsByAccount.get(r.id) ?? null
      return {
        accountId: r.id,
        companyName: r.company_name,
        companyDomain: r.company_domain,
        mappingVerificationStatus: map?.verification_status ?? null,
        lastObservedAt: obs?.observed_at ?? null,
        lastObservedStage: obs?.stage ?? null,
        lastObservedStatus: obs?.status ?? null,
      }
    })

    await logProductEvent({ userId: user.id, eventName: 'revenue_workflow_summary_viewed', eventProps: { workspaceId: ws.id, accounts: accounts.length } })

    return ok({ workspaceId: ws.id, health, recentReviews: reviews, accounts }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/revenue/workflow-summary', userId, bridge, requestId)
  }
})

