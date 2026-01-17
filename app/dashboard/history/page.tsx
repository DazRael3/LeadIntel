import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HistoryClient, HistoryLead } from '@/components/HistoryClient'
import { getPlan } from '@/lib/billing/plan'

export default async function HistoryPage() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?mode=signin&redirect=/dashboard/history')
  }

  const plan = await getPlan(supabase as any, user.id)

  const { data: leads } = await supabase
    .from('leads')
    .select('id, company_name, company_domain, company_url, ai_personalized_pitch, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <HistoryClient
      initialLeads={(leads || []) as HistoryLead[]}
      isPro={plan === 'pro'}
    />
  )
}
