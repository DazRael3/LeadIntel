import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { PlanningDashboardClient } from './planning-dashboard-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Planning | LeadIntel',
  description: 'Weekly planning board for outbound execution.',
}

export default async function PlanningDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/dashboard/planning')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'planning_intelligence' })
  if (!gate.ok) return <TeamUpgradeGate currentTier={gate.tier} sessionEmail={user.email ?? null} />

  return <PlanningDashboardClient />
}

