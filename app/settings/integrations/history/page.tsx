import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { IntegrationsHistoryClient } from './IntegrationsHistoryClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Delivery history | LeadIntel',
  description: 'Recent destination deliveries (sanitized).',
}

export default async function IntegrationsHistoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/integrations/history')

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok) return <TeamUpgradeGate />

  return <IntegrationsHistoryClient />
}

