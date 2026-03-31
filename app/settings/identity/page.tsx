import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { IdentitySettingsClient } from './identity-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Identity | LeadIntel',
  description: 'How authentication and access control work today.',
}

export default async function IdentitySettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/identity')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'multi_workspace_controls' })
  if (!gate.ok) return <TeamUpgradeGate />

  return <IdentitySettingsClient />
}

