import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isQaActorAllowed, isQaOverrideUiEnabled } from '@/lib/qa/overrides'
import { QaOverridesClient } from './qa-overrides-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'QA overrides | LeadIntel',
  description: 'Internal-only tier override controls (no billing mutation).',
  robots: { index: false, follow: false },
}

export default async function QaOverridesPage() {
  if (!isQaOverrideUiEnabled()) notFound()

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/settings/qa')
  if (!isQaActorAllowed(user.email ?? null)) notFound()

  return <QaOverridesClient />
}

