import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { PartnerAccessClient } from './partner-access-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Partner Access | LeadIntel',
  description: 'Grant and revoke delegated access for operators and partners.',
}

export default async function PartnerAccessPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/settings/partner-access')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'partner_dashboard' })
  if (!gate.ok) return <TeamUpgradeGate />

  return <PartnerAccessClient />
}

