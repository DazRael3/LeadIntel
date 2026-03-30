import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PlanProvider } from '@/components/PlanProvider'
import { getPlan } from '@/lib/billing/plan'
import { getBuildInfo } from '@/lib/debug/buildInfo'
import { WatchlistsClient } from './WatchlistsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Watchlists | LeadIntel',
  description: 'Multi-watchlists with notes and reminders.',
  robots: { index: false, follow: false },
}

export default async function WatchlistsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/login?mode=signin&redirect=/watchlists')

  let subscriptionTier: 'free' | 'pro' = 'free'
  try {
    subscriptionTier = await getPlan(supabase as Parameters<typeof getPlan>[0], user.id)
  } catch {
    subscriptionTier = 'free'
  }

  const buildInfo = getBuildInfo()

  return (
    <PlanProvider initialPlan={subscriptionTier} initialBuildInfo={buildInfo}>
      <WatchlistsClient />
    </PlanProvider>
  )
}

