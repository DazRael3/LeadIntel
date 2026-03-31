import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { requireCapability } from '@/lib/billing/require-capability'
import { GovernanceSettingsClient } from './governance-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Governance | LeadIntel',
  description: 'Audit coverage, access review, and policy history.',
}

export default async function GovernanceSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/governance')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'audit_log' })
  if (!gate.ok) return <TeamUpgradeGate />

  return <GovernanceSettingsClient />
}

