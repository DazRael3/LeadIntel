import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { ReportingSettingsClient } from './reporting-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reporting | LeadIntel',
  description: 'Governance controls for executive and command-center surfaces.',
}

export default async function ReportingSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/settings/reporting')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'team_dashboards' })
  if (!gate.ok) return <TeamUpgradeGate currentTier={gate.tier} sessionEmail={user.email ?? null} />

  return <ReportingSettingsClient />
}

