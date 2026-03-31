import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { ApiSettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'API | LeadIntel',
  description: 'Workspace API access, keys, and usage.',
}

export default async function ApiSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/settings/api')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'platform_api_access' })
  if (!gate.ok) return <TeamUpgradeGate />

  return <ApiSettingsClient />
}

