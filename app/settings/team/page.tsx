import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { TeamSettingsClient } from './TeamSettingsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Team | LeadIntel',
  description: 'Manage members and roles.',
  openGraph: {
    title: 'Team | LeadIntel',
    description: 'Manage members and roles.',
    url: 'https://dazrael.com/settings/team',
  },
}

export default async function TeamSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login?mode=signin&redirect=/settings/team')
  }

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok) {
    return <TeamUpgradeGate />
  }

  return <TeamSettingsClient />
}

