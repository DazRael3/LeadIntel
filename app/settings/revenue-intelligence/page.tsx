import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { RevenueIntelligenceSettingsClient } from './revenue-intelligence-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Revenue intelligence | LeadIntel',
  description: 'Closed-loop CRM intelligence governance.',
}

export default async function RevenueIntelligenceSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/revenue-intelligence')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'revenue_intelligence' })
  if (!gate.ok) return <TeamUpgradeGate />

  return <RevenueIntelligenceSettingsClient />
}

