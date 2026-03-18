import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { ExecutiveDashboardClient } from './executive-dashboard-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Executive | LeadIntel',
  description: 'High-signal workflow summary for managers and executives.',
}

export default async function ExecutivePage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/dashboard/executive')

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok)
    return (
      <TeamUpgradeGate
        heading="Executive"
        subtitle="High-signal workflow summary for managers and executives."
        currentTier={gate.tier}
        whyLocked="Executive reporting is a Team feature because it summarizes shared activity and outcomes across the workspace."
        bullets={[
          'Manager-grade visibility across workflows',
          'Clean summaries designed for review and decision-making',
          'Team-level context (not just single-user activity)',
        ]}
        primaryCtaHref="/pricing?target=team"
        primaryCtaLabel="Upgrade to Team"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="See pricing"
      />
    )

  return <ExecutiveDashboardClient />
}

