import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/billing/require-capability'
import { TeamUpgradeGate } from '@/components/team/TeamUpgradeGate'
import { ContentSettingsClient } from './content-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Content | LeadIntel',
  description: 'Content draft review queue (internal, review-first).',
}

export default async function ContentSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/content')

  const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'prospect_watch' })
  if (!gate.ok)
    return (
      <TeamUpgradeGate
        heading="Content"
        subtitle="Review-first content drafts (LinkedIn posts)."
        currentTier={gate.tier}
        sessionEmail={user.email ?? null}
        whyLocked="Content governance and shared rollout are Team surfaces."
        bullets={['Review-first post drafts', 'Signal-grounded angles', 'Copy/export workflow']}
        primaryCtaHref="/pricing?target=team"
        primaryCtaLabel="Upgrade to Team"
        secondaryCtaHref="/pricing"
        secondaryCtaLabel="See pricing"
      />
    )

  return <ContentSettingsClient />
}

