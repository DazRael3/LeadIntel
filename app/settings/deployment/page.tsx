import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { DeploymentSettingsClient } from './deployment-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Deployment | LeadIntel',
  description: 'Deployment readiness and go-live checklist.',
}

export default async function DeploymentSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/deployment')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'deployment_readiness' })
  if (!gate.ok) return <TeamUpgradeGate />

  return <DeploymentSettingsClient />
}

