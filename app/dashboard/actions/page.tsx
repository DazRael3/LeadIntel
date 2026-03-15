import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { ActionsClient } from './ActionsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Actions | LeadIntel',
  description: 'Workspace action queue.',
}

export default async function ActionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/dashboard/actions')

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok)
    return (
      <TeamUpgradeGate
        heading="Actions"
        subtitle="Route follow-up work across your team with a shared action queue."
        whyLocked="Actions is a Team feature because it coordinates shared execution (routing, ownership, and operational handoff) across multiple reps."
        bullets={[
          'Shared action queue with clear ownership',
          'Operational routing to destinations and team workflows',
          'Team visibility for managers and operators',
        ]}
        primaryCtaHref="/pricing?target=team"
        primaryCtaLabel="Upgrade to Team"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="See pricing"
      />
    )

  return <ActionsClient />
}

