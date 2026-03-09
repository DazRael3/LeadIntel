import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'
import { getOpportunityContext } from '@/lib/services/opportunity-context'
import { buildWorkflowOutcomeLinkage } from '@/lib/services/workflow-outcome-linkage'
import { buildAttributionSupportSummary } from '@/lib/services/attribution-support'

export async function buildClosedLoopBundle(args: {
  supabase: SupabaseClient
  workspaceId: string
  accountId: string
  policies: WorkspacePolicies
}): Promise<{
  opportunityContext: Awaited<ReturnType<typeof getOpportunityContext>>
  workflowOutcomeLink: Awaited<ReturnType<typeof buildWorkflowOutcomeLinkage>>
  attributionSupport: Awaited<ReturnType<typeof buildAttributionSupportSummary>>
}> {
  const windowDays = args.policies.revenueIntelligence.defaultLinkageWindowDays
  const [opportunityContext, workflowOutcomeLink] = await Promise.all([
    getOpportunityContext({ supabase: args.supabase, workspaceId: args.workspaceId, accountId: args.accountId }),
    buildWorkflowOutcomeLinkage({ supabase: args.supabase, workspaceId: args.workspaceId, accountId: args.accountId, windowDays }),
  ])

  const attributionSupport = await buildAttributionSupportSummary({
    supabase: args.supabase,
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    windowDays,
    attributionEnabled: args.policies.revenueIntelligence.attributionSupportEnabled,
    ambiguousVisible: args.policies.revenueIntelligence.ambiguousVisibleToViewerRoles,
  })

  return { opportunityContext, workflowOutcomeLink, attributionSupport }
}

