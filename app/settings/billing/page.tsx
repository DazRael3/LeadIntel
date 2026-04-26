import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserTierForGating } from '@/lib/team/gating'
import { getProductPlanDetailsForTier } from '@/lib/billing/product-plan'
import { BillingSettingsClient } from './BillingSettingsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Billing | LeadIntel',
  description: 'View your current plan and manage Stripe billing.',
  openGraph: {
    title: 'Billing | LeadIntel',
    description: 'View your current plan and manage Stripe billing.',
    url: 'https://raelinfo.com/settings/billing',
  },
}

export default async function BillingSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login?mode=signin&redirect=/settings/billing')
  }

  const tier = await getUserTierForGating({
    userId: user.id,
    sessionEmail: user.email ?? null,
    supabase,
  })
  const plan = getProductPlanDetailsForTier(tier)

  return <BillingSettingsClient email={user.email ?? null} tier={tier} plan={plan} />
}
