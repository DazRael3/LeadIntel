import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { IntelligenceSettingsClient } from './intelligence-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Intelligence | LeadIntel',
  description: 'Recommendation and learning controls (truthful, enforced).',
}

export default async function IntelligenceSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/intelligence')

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok) return <TeamUpgradeGate />

  return <IntelligenceSettingsClient />
}

