import type { SupabaseClient } from '@supabase/supabase-js'
import { getAccountExplainability } from '@/lib/data/getAccountExplainability'
import { buildAccountPlan } from '@/lib/revenue/planning'
import type { AccountPlan, ForecastSupportSummary, MultiTouchPlan, PipelineInfluenceSummary, FollowThroughSummary } from '@/lib/revenue/types'
import { buildPipelineInfluenceSummary } from '@/lib/services/pipeline-influence'
import { buildFollowThroughSummary } from '@/lib/services/follow-through'
import { buildMultiTouchPlan } from '@/lib/services/multi-touch-planning'
import { buildForecastSupportSummary } from '@/lib/services/forecast-support'

export async function getAccountRevenueIntelligence(args: {
  supabase: SupabaseClient
  userId: string
  workspaceId: string
  accountId: string
  window: '7d' | '30d' | '90d' | 'all'
}): Promise<{
  explainability: Awaited<ReturnType<typeof getAccountExplainability>>
  plan: AccountPlan
  influence: PipelineInfluenceSummary
  followThrough: FollowThroughSummary
  touchPlan: MultiTouchPlan
} | null> {
  const ex = await getAccountExplainability({
    supabase: args.supabase,
    userId: args.userId,
    accountId: args.accountId,
    window: args.window,
    type: null,
    sort: 'recent',
    limit: 50,
  })
  if (!ex) return null

  const plan = buildAccountPlan({ workspaceId: args.workspaceId, accountId: args.accountId, window: args.window, ex })
  const influence = await buildPipelineInfluenceSummary({ supabase: args.supabase, workspaceId: args.workspaceId, accountId: args.accountId, window: args.window, ex })
  const followThrough = await buildFollowThroughSummary({ supabase: args.supabase, workspaceId: args.workspaceId, accountId: args.accountId, window: args.window, ex })
  const touchPlan = await buildMultiTouchPlan({ supabase: args.supabase, workspaceId: args.workspaceId, accountId: args.accountId, window: args.window, ex })

  return { explainability: ex, plan, influence, followThrough, touchPlan }
}

export async function getWorkspaceForecastSupport(args: {
  supabase: SupabaseClient
  userId: string
  workspaceId: string
  windowDays: number
}): Promise<ForecastSupportSummary> {
  return buildForecastSupportSummary({ supabase: args.supabase, workspaceId: args.workspaceId, windowDays: args.windowDays })
}

