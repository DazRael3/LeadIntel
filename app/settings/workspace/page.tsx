import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { WorkspaceSettingsClient } from './workspace-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Workspace | LeadIntel',
  description: 'Deployment controls and workspace policies.',
}

export default async function WorkspaceSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/workspace')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'multi_workspace_controls' })
  if (!gate.ok)
    return (
      <TeamUpgradeGate
        heading="Workspace"
        subtitle="Workspace policies and operational controls."
        currentTier={gate.tier}
        sessionEmail={user.email ?? null}
        whyLocked="Workspace governance is a Team feature because it manages shared policies, rollout controls, and operational settings for the whole team."
        bullets={['Workspace policies and governance', 'Operational controls for rollouts', 'Shared settings for admins and operators']}
        primaryCtaHref="/pricing?target=team"
        primaryCtaLabel="Upgrade to Team"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="See pricing"
      />
    )

  return <WorkspaceSettingsClient />
}

