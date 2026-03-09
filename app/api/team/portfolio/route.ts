import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(25).max(200).optional().default(100),
})

type ProgramRow = {
  id: string
  lead_id: string | null
  account_domain: string | null
  account_name: string | null
  program_state: string
  updated_at: string
}

type QueueRow = {
  id: string
  lead_id: string | null
  action_type: string
  status: string
  reason: string | null
  error: string | null
  assigned_to_user_id: string | null
  created_at: string
  payload_meta: unknown
}

function safeMeta(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}
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

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    if (!policies.planning.planningIntelligenceEnabled) {
      return fail(ErrorCode.FORBIDDEN, 'Portfolio surfaces are disabled for this workspace', undefined, undefined, bridge, requestId)
    }

    const [programRes, queueRes] = await Promise.all([
      supabase
        .schema('api')
        .from('account_program_accounts')
        .select('id, lead_id, account_domain, account_name, program_state, updated_at')
        .eq('workspace_id', ws.id)
        .order('updated_at', { ascending: false })
        .limit(parsed.data.limit),
      supabase
        .schema('api')
        .from('action_queue_items')
        .select('id, lead_id, action_type, status, reason, error, assigned_to_user_id, created_at, payload_meta')
        .eq('workspace_id', ws.id)
        .order('created_at', { ascending: false })
        .limit(parsed.data.limit),
    ])

    const programs = (programRes.data ?? []) as unknown as ProgramRow[]
    const queue = (queueRes.data ?? []) as unknown as QueueRow[]

    const recentAccounts = queue
      .filter((q) => q.lead_id)
      .map((q) => {
        const meta = safeMeta(q.payload_meta)
        const companyName = typeof meta.companyName === 'string' ? (meta.companyName as string) : null
        const companyDomain = typeof meta.companyDomain === 'string' ? (meta.companyDomain as string) : null
        return {
          leadId: q.lead_id,
          companyName,
          companyDomain,
          status: q.status,
          actionType: q.action_type,
          assignedTo: q.assigned_to_user_id,
          createdAt: q.created_at,
        }
      })
      .slice(0, 50)

    await logProductEvent({ userId: user.id, eventName: 'portfolio_board_viewed', eventProps: { workspaceId: ws.id } })

    return ok({ workspace: { id: ws.id, name: ws.name }, role: membership.role, programs, recentAccounts }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/team/portfolio', userId, bridge, requestId)
  }
})

