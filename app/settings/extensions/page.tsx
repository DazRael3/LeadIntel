import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { ExtensionsSettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Extensions | LeadIntel',
  description: 'Custom actions and bounded extensions.',
}

export default async function ExtensionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/settings/extensions')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'extensions' })
  if (!gate.ok) return <TeamUpgradeGate />

  return <ExtensionsSettingsClient />
}

