import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { ExperimentsSettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Experiments | LeadIntel',
  description: 'Safe experimentation, rollouts, and growth ops controls.',
}

export default async function ExperimentsSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/experiments')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'experiments' })
  if (!gate.ok) return <TeamUpgradeGate currentTier={gate.tier} sessionEmail={user.email ?? null} />

  return <ExperimentsSettingsClient />
}

