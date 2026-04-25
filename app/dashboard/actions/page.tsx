import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
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

  const gate = await requireCapability({
    userId: user.id,
    sessionEmail: user.email ?? null,
    supabase,
    capability: 'action_queue',
  })
  if (!gate.ok)
    return (
      <TeamUpgradeGate
        heading="Actions"
        subtitle="Route follow-up work across your team with a shared action queue."
        currentTier={gate.tier}
        sessionEmail={user.email ?? null}
        whyLocked="Actions requires at least the Pro plan because it coordinates campaign and follow-up execution."
        bullets={[
          'Shared action queue with clear ownership',
          'Operational routing to destinations and team workflows',
          'Operational routing and campaign automation',
        ]}
        primaryCtaHref="/pricing?target=closer"
        primaryCtaLabel="Upgrade to Pro"
        unlockPlanLabel="Pro"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="See pricing"
      />
    )

  return <ActionsClient />
}

