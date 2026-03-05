import { createClient } from '@/lib/supabase/server'
import { getPlanDetails, type PlanTier } from '@/lib/billing/plan'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listSavedReportsForUser, type SavedReportSummary } from '@/lib/services/pitchesList'

export type ReportsHubPageData = {
  user: { id: string; email: string | null } | null
  tier: PlanTier | null
  reports: SavedReportSummary[]
}

export async function loadReportsHubPageData(): Promise<ReportsHubPageData> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, tier: null, reports: [] }
  }

  const details = await getPlanDetails(supabase as Parameters<typeof getPlanDetails>[0], user.id)
  const tier: PlanTier = details.plan === 'pro' ? 'closer' : 'starter'

  const reports = await listSavedReportsForUser(
    supabase as unknown as SupabaseClient,
    user.id,
    tier === 'starter' ? { limit: 3 } : undefined
  )

  return { user: { id: user.id, email: user.email ?? null }, tier, reports }
}

