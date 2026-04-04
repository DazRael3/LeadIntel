import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { ApiUsageClient } from './usage-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'API Usage | LeadIntel',
  description: 'Sanitized API request history.',
}

export default async function ApiUsagePage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/settings/api/usage')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'platform_api_access' })
  if (!gate.ok) return <TeamUpgradeGate currentTier={gate.tier} sessionEmail={user.email ?? null} />

  return <ApiUsageClient />
}

