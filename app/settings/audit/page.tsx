import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { AuditSettingsClient } from './AuditSettingsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Audit log | LeadIntel',
  description: 'Admin visibility across workspace activity.',
  openGraph: {
    title: 'Audit log | LeadIntel',
    description: 'Admin visibility across workspace activity.',
    url: 'https://dazrael.com/settings/audit',
  },
}

export default async function AuditSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login?mode=signin&redirect=/settings/audit')
  }

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok) return <TeamUpgradeGate />

  return <AuditSettingsClient />
}

