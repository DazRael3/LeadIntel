import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { AssistantSettingsClient } from './assistant-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Assistant | LeadIntel',
  description: 'Governance controls for the conversational assistant.',
}

export default async function AssistantSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/settings/assistant')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'assistant' })
  if (!gate.ok) return <TeamUpgradeGate />

  return <AssistantSettingsClient />
}

