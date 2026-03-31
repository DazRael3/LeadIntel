import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

type FeedbackAgg = { kind: string; count: number }
type OutcomeAgg = { outcome: string; count: number }

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId, sessionEmail: null, supabase, capability: 'benchmarks' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId })
    const ws = await getCurrentWorkspace({ supabase, userId })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const [fbRes, outRes] = await Promise.all([
      supabase.schema('api').from('recommendation_feedback').select('kind').eq('workspace_id', ws.id).limit(500),
      supabase.schema('api').from('outcome_records').select('outcome').eq('workspace_id', ws.id).limit(500),
    ])

    const fbCounts = new Map<string, number>()
    for (const r of fbRes.data ?? []) {
      const k = (r as { kind?: unknown }).kind
      if (typeof k !== 'string') continue
      fbCounts.set(k, (fbCounts.get(k) ?? 0) + 1)
    }

    const outCounts = new Map<string, number>()
    for (const r of outRes.data ?? []) {
      const k = (r as { outcome?: unknown }).outcome
      if (typeof k !== 'string') continue
      outCounts.set(k, (outCounts.get(k) ?? 0) + 1)
    }

    const feedbackAgg: FeedbackAgg[] = Array.from(fbCounts.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)

    const outcomeAgg: OutcomeAgg[] = Array.from(outCounts.entries())
      .map(([outcome, count]) => ({ outcome, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)

    await logProductEvent({ userId, eventName: 'adaptive_playbook_insights_viewed', eventProps: { workspaceId: ws.id } })

    return ok(
      {
        workspace: { id: ws.id, name: ws.name },
        role: membership.role,
        feedbackAgg,
        outcomeAgg,
      },
      undefined,
      bridge,
      requestId
    )
  } catch (e) {
    return asHttpError(e, '/api/workspace/intelligence/insights', userId, bridge, requestId)
  }
})

