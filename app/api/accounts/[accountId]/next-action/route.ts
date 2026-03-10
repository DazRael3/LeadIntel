import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getAccountExplainability } from '@/lib/data/getAccountExplainability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { deriveNextBestAction } from '@/lib/services/next-best-action'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional(),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const url = new URL(request.url)
    const accountId = url.pathname.split('/').filter(Boolean).at(-2)
    if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

    const parsed = QuerySchema.safeParse({ window: url.searchParams.get('window') ?? undefined })
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid query params', parsed.error.flatten(), { status: 400 }, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId })
    const ws = await getCurrentWorkspace({ supabase, userId })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const explainability = await getAccountExplainability({
      supabase,
      userId,
      accountId,
      window: parsed.data.window,
      type: null,
      sort: 'recent',
      limit: 50,
    })
    if (!explainability) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })

    const { data: endpoints } = await supabase
      .schema('api')
      .from('webhook_endpoints')
      .select('id, enabled')
      .eq('workspace_id', ws.id)
      .eq('enabled', true)
      .limit(1)

    const action = deriveNextBestAction({
      inputs: {
        window: (parsed.data.window ?? '30d') as '7d' | '30d' | '90d' | 'all',
        scoreExplainability: explainability.scoreExplainability,
        momentum: explainability.momentum,
        firstPartyIntent: explainability.firstPartyIntent,
        dataQuality: explainability.dataQuality,
        sourceHealth: explainability.sourceHealth,
        people: explainability.people.personas,
        account: { id: explainability.account.id, name: explainability.account.name, domain: explainability.account.domain },
      },
      policies,
      webhooksEnabled: (endpoints ?? []).length > 0,
    })

    await logProductEvent({ userId, eventName: 'next_best_action_viewed', eventProps: { workspaceId: ws.id, accountId, actionId: action.id } })

    return ok({ workspaceId: ws.id, role: membership.role, action }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/accounts/[accountId]/next-action', userId, bridge, requestId)
  }
})

