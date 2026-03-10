import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { getAccountExplainability } from '@/lib/data/getAccountExplainability'
import { buildPipelineInfluenceSummary } from '@/lib/services/pipeline-influence'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const url = new URL(request.url)
    const accountId = url.pathname.split('/').filter(Boolean).at(-2)
    if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    if (!policies.planning.planningIntelligenceEnabled) {
      return fail(ErrorCode.FORBIDDEN, 'Planning intelligence is disabled for this workspace', undefined, undefined, bridge, requestId)
    }

    const ex = await getAccountExplainability({
      supabase,
      userId: user.id,
      accountId,
      window: parsed.data.window,
      type: null,
      sort: 'recent',
      limit: 50,
    })
    if (!ex) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)

    const influence = await buildPipelineInfluenceSummary({
      supabase,
      workspaceId: ws.id,
      accountId,
      window: parsed.data.window,
      ex,
    })

    await logProductEvent({
      userId: user.id,
      eventName: 'pipeline_influence_viewed',
      eventProps: { workspaceId: ws.id, accountId, window: parsed.data.window, label: influence.influence },
    })

    return ok({ workspaceId: ws.id, role: membership.role, influence }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/accounts/[accountId]/pipeline-influence', userId, bridge, requestId)
  }
})

