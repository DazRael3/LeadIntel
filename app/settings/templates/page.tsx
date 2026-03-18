import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { TemplatesSettingsClient } from './TemplatesSettingsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Team templates | LeadIntel',
  description: 'Team templates and approvals.',
  openGraph: {
    title: 'Team templates | LeadIntel',
    description: 'Team templates and approvals.',
    url: 'https://dazrael.com/settings/templates',
  },
}

export default async function TemplatesSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login?mode=signin&redirect=/settings/templates')
  }

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok)
    return (
      <TeamUpgradeGate
        heading="Templates"
        subtitle="Shared templates and approvals for consistent outbound."
        currentTier={gate.tier}
        whyLocked="Workspace template governance is a Team feature because it supports shared standards, approvals, and consistent execution across reps."
        bullets={['Shared template library', 'Approvals and governance controls', 'Consistency across reps and segments']}
        primaryCtaHref="/pricing?target=team"
        primaryCtaLabel="Upgrade to Team"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="See pricing"
      />
    )

  return <TemplatesSettingsClient />
}

