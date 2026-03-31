import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { RolloutsDashboardClient } from './rollouts-dashboard-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Rollouts | LeadIntel',
  description: 'Distribute templates/playbooks across workspaces with copy semantics.',
}

export default async function RolloutsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/dashboard/rollouts')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'partner_dashboard' })
  if (!gate.ok) return <TeamUpgradeGate />

  return <RolloutsDashboardClient />
}

