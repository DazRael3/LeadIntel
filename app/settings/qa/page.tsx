import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getQaOverrideConfig, isQaActorAllowlisted, isQaOverrideUiEnabled } from '@/lib/qa/overrides'
import { QaOverridesClient } from './qa-overrides-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'QA overrides | LeadIntel',
  description: 'Internal-only tier override controls (no billing mutation).',
  robots: { index: false, follow: false },
}

export default async function QaOverridesPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/qa')
  const cfg = getQaOverrideConfig()
  const actorEmail = (user.email ?? '').trim().toLowerCase()

  // Page is internal-only: require an explicit actor allowlist entry to render anything.
  // This avoids exposing QA surfaces to normal customer accounts.
  if (!actorEmail || !isQaActorAllowlisted(actorEmail)) notFound()

  const enabled = isQaOverrideUiEnabled()
  return (
    <QaOverridesClient
      actorEmail={actorEmail}
      enabled={enabled}
      configured={cfg.configured}
      misconfigReason={cfg.misconfigReason}
      actorAllowlisted={true}
      actorAllowlistCount={cfg.actorEmails.length}
      targetAllowlistCount={cfg.targetEmails.length}
    />
  )
}

