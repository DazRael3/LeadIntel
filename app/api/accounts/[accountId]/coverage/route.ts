import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { getAccountCoverage } from '@/lib/coverage/engine'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
})

const PatchSchema = z.object({
  programState: z.enum(['strategic', 'named', 'expansion_watch', 'monitor', 'standard']),
  note: z.string().trim().min(1).max(600).optional(),
})

function extractAccountId(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  const id = parts.at(-2)
  return typeof id === 'string' && id.trim().length > 0 ? id : null
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    const accountId = extractAccountId(new URL(request.url).pathname)
    if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    if (!policies.planning.planningIntelligenceEnabled) {
      // Coverage is portfolio-level; we reuse planning gating rather than introducing a new plan tier.
      return fail(ErrorCode.FORBIDDEN, 'Account orchestration is disabled for this workspace', undefined, undefined, bridge, requestId)
    }

    // Best-effort domain lookup (user-owned lead only).
    const { data: lead } = await supabase.schema('api').from('leads').select('company_domain').eq('id', accountId).eq('user_id', user.id).maybeSingle()
    const accountDomain = (lead as { company_domain?: unknown } | null)?.company_domain
    const domain = typeof accountDomain === 'string' ? accountDomain : null

    const summary = await getAccountCoverage({
      supabase,
      userId: user.id,
      workspaceId: ws.id,
      accountId,
      window: parsed.data.window,
      accountDomain: domain,
    })
    if (!summary) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)

    await logProductEvent({
      userId: user.id,
      eventName: 'coverage_summary_viewed',
      eventProps: { workspaceId: ws.id, accountId, window: parsed.data.window, state: summary.state },
    })

    return ok({ workspaceId: ws.id, role: membership.role, summary }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/accounts/[accountId]/coverage', userId, bridge, requestId)
  }
})

export const PATCH = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = PatchSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      const accountId = extractAccountId(new URL(request.url).pathname)
      if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      // Only privileged roles can mark program states (bounded governance).
      if (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager') {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const { data: lead } = await supabase.schema('api').from('leads').select('company_domain, company_name').eq('id', accountId).eq('user_id', user.id).maybeSingle()
      const domain = typeof (lead as { company_domain?: unknown } | null)?.company_domain === 'string' ? ((lead as any).company_domain as string) : null
      const name = typeof (lead as { company_name?: unknown } | null)?.company_name === 'string' ? ((lead as any).company_name as string) : null

      const { error } = await supabase
        .schema('api')
        .from('account_program_accounts')
        .upsert(
          {
            workspace_id: ws.id,
            lead_id: accountId,
            account_domain: domain,
            account_name: name,
            program_state: parsed.data.programState,
            note: parsed.data.note ?? null,
            set_by: user.id,
          },
          { onConflict: 'workspace_id,lead_id' }
        )

      if (error) return fail(ErrorCode.DATABASE_ERROR, 'Save failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'account_program.updated',
        targetType: 'lead',
        targetId: accountId,
        meta: { programState: parsed.data.programState },
        request,
      })

      await logProductEvent({
        userId: user.id,
        eventName: 'strategic_account_marked',
        eventProps: { workspaceId: ws.id, accountId, programState: parsed.data.programState },
      })

      return ok({ saved: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/accounts/[accountId]/coverage', userId, bridge, requestId)
    }
  },
  { bodySchema: PatchSchema }
)

