import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopNav } from '@/components/TopNav'
import { OnboardingClient } from './ui/OnboardingClient'

export const dynamic = 'force-dynamic'

type UserSettingsRow = {
  onboarding_completed?: boolean | null
  primary_goal?: string | null
  onboarding_v2_step?: number | null
  onboarding_workflow?: string | null
  onboarding_started_at?: string | null
}

type LeadRow = { id: string; company_name: string | null; company_domain: string | null; company_url: string | null }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?mode=signup&redirect=/onboarding')
  }

  const [{ data: settingsRow }, { count: targetsCount }, { count: pitchesCount }, { count: reportsCount }, { count: briefsCount }, { data: lastLead }] =
    await Promise.all([
      supabase
        .from('user_settings')
        .select('onboarding_completed, primary_goal, onboarding_v2_step, onboarding_workflow, onboarding_started_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('pitches').select('id', { count: 'exact', head: true }),
      supabase.from('user_reports').select('id', { count: 'exact', head: true }).eq('report_kind', 'competitive'),
      supabase.from('user_reports').select('id', { count: 'exact', head: true }).eq('report_kind', 'account_brief'),
      supabase.from('leads').select('id, company_name, company_domain, company_url').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

  const settings = (settingsRow ?? null) as UserSettingsRow | null
  const lead = (lastLead ?? null) as unknown as LeadRow | null

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <TopNav />
      <main className="container mx-auto px-6 py-10">
        <OnboardingClient
          initial={{
            onboardingCompleted: Boolean(settings?.onboarding_completed),
            primaryGoal: settings?.primary_goal ?? null,
            onboardingV2Step: typeof settings?.onboarding_v2_step === 'number' ? settings.onboarding_v2_step : null,
            onboardingWorkflow: settings?.onboarding_workflow ?? null,
            onboardingStartedAt: settings?.onboarding_started_at ?? null,
            signals: {
              targetsCount: typeof targetsCount === 'number' ? targetsCount : 0,
              pitchesCount: typeof pitchesCount === 'number' ? pitchesCount : 0,
              reportsCount: typeof reportsCount === 'number' ? reportsCount : 0,
              hasSavedBrief: typeof briefsCount === 'number' ? briefsCount > 0 : false,
            },
            sampleTarget: lead
              ? {
                  leadId: lead.id,
                  companyName: lead.company_name,
                  companyDomain: lead.company_domain,
                  companyUrl: lead.company_url,
                }
              : null,
          }}
        />
      </main>
    </div>
  )
}

