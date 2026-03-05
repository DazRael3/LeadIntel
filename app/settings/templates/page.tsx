import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { TemplatesSettingsClient } from './TemplatesSettingsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Templates | LeadIntel',
  description: 'Shared templates and approvals.',
  openGraph: {
    title: 'Templates | LeadIntel',
    description: 'Shared templates and approvals.',
    url: 'https://dazrael.com/settings/templates',
  },
}

export default async function TemplatesSettingsPage() {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login?mode=signin&redirect=/settings/templates')
  }

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok) return <TeamUpgradeGate />

  return <TemplatesSettingsClient />
}

