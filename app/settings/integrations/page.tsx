import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireTeamPlan } from '@/lib/team/gating'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { IntegrationsSettingsClient } from './IntegrationsSettingsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Integrations | LeadIntel',
  description: 'Webhooks and exports.',
  openGraph: {
    title: 'Integrations | LeadIntel',
    description: 'Webhooks and exports.',
    url: 'https://dazrael.com/settings/integrations',
  },
}

export default async function IntegrationsSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login?mode=signin&redirect=/settings/integrations')
  }

  const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
  if (!gate.ok)
    return (
      <TeamUpgradeGate
        heading="Integrations"
        subtitle="Exports and webhooks for operational handoff."
        whyLocked="Integrations are a Team feature because they power shared delivery and governance across the workspace."
        bullets={['Webhooks and destination exports', 'Delivery history and operational visibility', 'Shared configuration for the workspace']}
        primaryCtaHref="/pricing?target=team"
        primaryCtaLabel="Upgrade to Team"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="See pricing"
      />
    )

  return <IntegrationsSettingsClient />
}

