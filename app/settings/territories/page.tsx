import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { TerritoriesSettingsClient } from './territories-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Territories | LeadIntel',
  description: 'Territory and segment rules for routing and coverage.',
}

export default async function TerritoriesSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/territories')

  const gate = await requireCapability({
    userId: user.id,
    sessionEmail: user.email ?? null,
    supabase,
    capability: 'territory_controls',
  })
  if (!gate.ok) return <TeamUpgradeGate currentTier={gate.tier} sessionEmail={user.email ?? null} />

  return <TerritoriesSettingsClient />
}

