import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { VerificationDashboardClient } from './verification-dashboard-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Verification | LeadIntel',
  description: 'Outcome verification queue for CRM linkage and downstream observations.',
}

export default async function VerificationPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/dashboard/verification')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'revenue_intelligence' })
  if (!gate.ok) return <TeamUpgradeGate />

  return <VerificationDashboardClient />
}

