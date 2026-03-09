import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getAccountExplainability } from '@/lib/data/getAccountExplainability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { buildAccountRecommendationBundle, RECOMMENDATION_ENGINE_VERSION } from '@/lib/recommendations/engine'
import { getLearningContextForWorkspace } from '@/lib/services/ranking-intelligence'
import { logProductEvent } from '@/lib/services/analytics'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional(),
})

type SnapshotRow = { priority_score: number; feature_key: string; computed_at: string }

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
    const workspace = await getCurrentWorkspace({ supabase, userId })
    if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: workspace.id })

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

    const prevRes = await supabase
      .schema('api')
      .from('account_recommendation_snapshots')
      .select('priority_score, feature_key, computed_at')
      .eq('workspace_id', workspace.id)
      .eq('account_id', accountId)
      .eq('recommendation_version', RECOMMENDATION_ENGINE_VERSION)
      .eq('window', parsed.data.window ?? '30d')
      .maybeSingle()

    const previousSnapshot = prevRes.data
      ? ({
          priorityScore: (prevRes.data as unknown as SnapshotRow).priority_score,
          featureKey: (prevRes.data as unknown as SnapshotRow).feature_key,
          computedAt: (prevRes.data as unknown as SnapshotRow).computed_at,
        } as const)
      : null

    const learning = policies.intelligence.adaptiveRecommendationsEnabled
      ? await getLearningContextForWorkspace({
          supabase,
          workspaceId: workspace.id,
          windowDays: 30,
          recommendationType: 'account_priority',
        })
      : { feedback: null, outcomes: null }

    const { bundle, snapshot } = buildAccountRecommendationBundle({
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
      learning:
        policies.intelligence.outcomeLearningEnabled || policies.intelligence.feedbackAggregationEnabled
          ? {
              feedback: policies.intelligence.feedbackAggregationEnabled ? learning.feedback : null,
              outcomes: policies.intelligence.outcomeLearningEnabled ? learning.outcomes : null,
            }
          : { feedback: null, outcomes: null },
      previousSnapshot,
    })

    await supabase
      .schema('api')
      .from('account_recommendation_snapshots')
      .upsert(
        {
          workspace_id: workspace.id,
          account_id: accountId,
          recommendation_version: RECOMMENDATION_ENGINE_VERSION,
          window: parsed.data.window ?? '30d',
          priority_score: snapshot.priorityScore,
          feature_key: snapshot.featureKey,
          computed_at: snapshot.computedAt,
        },
        { onConflict: 'workspace_id,account_id,recommendation_version,window' }
      )

    await logProductEvent({
      userId,
      eventName: 'recommendation_viewed',
      eventProps: { accountId, workspaceId: workspace.id, version: bundle.recommendations[0]?.version ?? RECOMMENDATION_ENGINE_VERSION },
    })

    return ok({ workspaceId: workspace.id, role: membership.role, bundle }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/accounts/[accountId]/recommendations', userId, bridge, requestId)
  }
})

