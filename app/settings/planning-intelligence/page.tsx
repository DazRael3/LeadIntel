import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { PlanningIntelligenceSettingsClient } from './planning-intelligence-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Planning intelligence | LeadIntel',
  description: 'Account planning and pipeline influence controls (truthful, enforced).',
}

export default async function PlanningIntelligenceSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/planning-intelligence')

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok) return <TeamUpgradeGate />

  return <PlanningIntelligenceSettingsClient />
}

