import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { BrandingSettingsClient } from './branding-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Branding | LeadIntel',
  description: 'Workspace presentation controls (bounded; not white-label).',
}

export default async function BrandingSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/settings/branding')

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok) return <TeamUpgradeGate />

  return <BrandingSettingsClient />
}

