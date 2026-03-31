import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { SourcesSettingsClient } from './sources-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sources | LeadIntel',
  description: 'Source catalog and configuration status.',
}

export default async function SourcesSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/sources')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'team_dashboards' })
  if (!gate.ok)
    return (
      <TeamUpgradeGate
        heading="Sources"
        subtitle="Source catalog and configuration health for the workspace."
        currentTier={gate.tier}
        sessionEmail={user.email ?? null}
        whyLocked="Source governance is a Team feature because it controls shared ingestion and operational readiness across the workspace."
        bullets={['Source catalog visibility', 'Configuration status and readiness signals', 'Workspace-wide governance controls']}
        primaryCtaHref="/pricing?target=team"
        primaryCtaLabel="Upgrade to Team"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="See pricing"
      />
    )

  return <SourcesSettingsClient />
}

