import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { OperationsDashboardClient } from './operations-dashboard-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Operations | LeadIntel',
  description: 'Summary-safe multi-workspace operations view.',
}

export default async function OperationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/dashboard/operations')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'partner_dashboard' })
  if (!gate.ok) return <TeamUpgradeGate currentTier={gate.tier} sessionEmail={user.email ?? null} />

  return <OperationsDashboardClient />
}

