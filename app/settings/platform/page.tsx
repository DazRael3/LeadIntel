import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { PlatformSettingsClient } from './settings-client'
import { requireCapability } from '@/lib/billing/require-capability'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Platform | LeadIntel',
  description: 'API, embed, and extension governance controls.',
}

export default async function PlatformSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/settings/platform')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'platform_api_access' })
  if (!gate.ok) return <TeamUpgradeGate currentTier={gate.tier} sessionEmail={user.email ?? null} />

  return <PlatformSettingsClient />
}

