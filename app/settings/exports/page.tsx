import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { ExportsSettingsClient } from './ExportsSettingsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Exports | LeadIntel',
  description: 'Generate CSV exports.',
  openGraph: {
    title: 'Exports | LeadIntel',
    description: 'Generate CSV exports.',
    url: 'https://dazrael.com/settings/exports',
  },
}

export default async function ExportsSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login?mode=signin&redirect=/settings/exports')
  }

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok) return <TeamUpgradeGate />

  return <ExportsSettingsClient />
}

