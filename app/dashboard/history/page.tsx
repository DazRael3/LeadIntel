import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistoryClient, HistoryLead } from '@/components/HistoryClient'
import { getPlanDetails } from '@/lib/billing/plan'
import { getEntitlements } from '@/lib/billing/entitlements'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?mode=signin&redirect=/dashboard/history')
  }

  const details = await getPlanDetails(supabase as any, user.id)
  const entitlements = getEntitlements({
    plan: details.plan,
    trial: {
      active: Boolean(details.isAppTrial && details.appTrialEndsAt),
      endsAt: details.appTrialEndsAt ?? null,
    },
  })

  const { data: leads } = await supabase
    .from('leads')
    .select('id, company_name, company_domain, company_url, ai_personalized_pitch, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <HistoryClient
      initialLeads={(leads || []) as HistoryLead[]}
      canAccessPitchHistory={entitlements.canAccessPitchHistory}
      canExportLeads={entitlements.canExportLeads}
    />
  )
}
