import type { SupabaseClient } from '@supabase/supabase-js'
import { getAccountExplainability } from '@/lib/data/getAccountExplainability'
import { buildAccountCoverageSummary } from '@/lib/services/account-coverage'
import type { CoverageSummary } from '@/lib/coverage/types'

export async function getAccountCoverage(args: {
  supabase: SupabaseClient
  userId: string
  workspaceId: string
  accountId: string
  window: '7d' | '30d' | '90d' | 'all'
  accountDomain: string | null
}): Promise<CoverageSummary | null> {
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
  const summary = await buildAccountCoverageSummary({
    supabase: args.supabase,
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    accountDomain: args.accountDomain,
    window: args.window,
    ex,
  })
  return summary
}

