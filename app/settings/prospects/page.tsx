import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { ProspectsSettingsClient } from './prospects-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Prospects | LeadIntel',
  description: 'Prospect watch review queue (internal, review-first).',
}

export default async function ProspectsSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/prospects')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'prospect_watch' })
  if (!gate.ok)
    return (
      <TeamUpgradeGate
        heading="Prospects"
        subtitle="Prospect watch review queue and drafts (review-first)."
        currentTier={gate.tier}
        sessionEmail={user.email ?? null}
        whyLocked="Prospect watch is a Team surface because it’s workspace-governed and designed for shared rollout and review."
        bullets={['Review-first prospect queue', 'Why-now signal basis + scoring', 'Draft outreach for human approval']}
        primaryCtaHref="/pricing?target=team"
        primaryCtaLabel="Upgrade to Team"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="See pricing"
      />
    )

  return <ProspectsSettingsClient />
}

