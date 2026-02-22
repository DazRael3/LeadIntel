import { createClient } from '@/lib/supabase/server'
import { getPlanDetails, type PlanTier } from '@/lib/billing/plan'
import { getLatestPitchSummaryForUser, type LatestPitchSummary } from '@/lib/services/pitchesLatest'
import type { SupabaseClient } from '@supabase/supabase-js'

export type CompetitiveReportPageData = {
  user: { id: string; email: string | null } | null
  tier: PlanTier | null
  latestPitch: LatestPitchSummary | null
}

export async function loadCompetitiveReportPageData(): Promise<CompetitiveReportPageData> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, tier: null, latestPitch: null }
  }

  const details = await getPlanDetails(supabase as Parameters<typeof getPlanDetails>[0], user.id)
  const tier: PlanTier = details.plan === 'pro' ? 'closer' : 'starter'
  const latestPitch = await getLatestPitchSummaryForUser(supabase as unknown as SupabaseClient, user.id)

  return { user: { id: user.id, email: user.email ?? null }, tier, latestPitch }
}

