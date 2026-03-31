import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { CommandCenterClient } from './command-center-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Command Center | LeadIntel',
  description: 'Daily operating console for prioritization and action routing.',
}

export default async function CommandCenterPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/dashboard/command-center')

  const gate = await requireCapability({
    userId: user.id,
    sessionEmail: user.email ?? null,
    supabase,
    capability: 'team_dashboards',
  })
  if (!gate.ok)
    return (
      <TeamUpgradeGate
        heading="Command Center"
        subtitle="A team-level operating console for prioritization and action routing."
        currentTier={gate.tier}
        sessionEmail={user.email ?? null}
        whyLocked="Command Center is a Team view because it rolls up shared workflow state across reps and destinations."
        bullets={[
          'Team-wide workflow summary and routing context',
          'Operator visibility for planning and triage',
          'Shared execution, not just individual inbox views',
        ]}
        primaryCtaHref="/pricing?target=team"
        primaryCtaLabel="Upgrade to Team"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="See pricing"
      />
    )

  return <CommandCenterClient />
}

