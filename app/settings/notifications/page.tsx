import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { NotificationsSettingsClient } from './NotificationsSettingsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Email preferences | LeadIntel',
  description: 'Control onboarding tips and digest emails.',
  openGraph: {
    title: 'Email preferences | LeadIntel',
    description: 'Control onboarding tips and digest emails.',
    url: 'https://raelinfo.com/settings/notifications',
    images: [
      {
        url: '/api/og?title=Email%20preferences&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default async function NotificationsSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login?mode=signin&redirect=/settings/notifications')
  }

  const { data } = await supabase
    .from('user_settings')
    .select('product_tips_opt_in, digest_emails_opt_in, digest_enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  const row = (data ?? null) as {
    product_tips_opt_in?: boolean | null
    digest_emails_opt_in?: boolean | null
    digest_enabled?: boolean | null
  } | null

  return (
    <NotificationsSettingsClient
      initialProductTipsOptIn={row?.product_tips_opt_in ?? true}
      initialDigestEmailsOptIn={row?.digest_emails_opt_in ?? true}
      initialDigestEnabled={row?.digest_enabled ?? false}
    />
  )
}

