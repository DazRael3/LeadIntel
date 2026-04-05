import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { IntelligenceDashboardClient } from './intelligence-dashboard-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Intelligence | LeadIntel',
  description: 'Recommendation quality and learning insights.',
}

export default async function IntelligenceDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/dashboard/intelligence')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'adaptive_playbooks' })
  if (!gate.ok) return <TeamUpgradeGate currentTier={gate.tier} sessionEmail={user.email ?? null} />

  return <IntelligenceDashboardClient />
}

