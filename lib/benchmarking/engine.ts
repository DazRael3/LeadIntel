import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExplainabilityWindow } from '@/lib/data/getAccountExplainability'
import { getWorkflowBenchmarks } from '@/lib/services/workflow-benchmarks'
import { getAccountPeerPatternInsight } from '@/lib/services/peer-patterns'

export async function getTeamWorkflowBenchmarks(args: {
  supabase: SupabaseClient
  workspaceId: string
  windowDays: number
  enableCrossWorkspace: boolean
  enablePriorPeriod: boolean
}) {
  return getWorkflowBenchmarks(args)
}

export async function getPeerPatternForAccount(args: {
  supabase: SupabaseClient
  userId: string
  accountId: string
  window: ExplainabilityWindow
  crossWorkspaceEnabled: boolean
}) {
  return getAccountPeerPatternInsight(args)
}

