import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PlanProvider } from '@/components/PlanProvider'
import { getPlan } from '@/lib/billing/plan'
import { getBuildInfo } from '@/lib/debug/buildInfo'
import { AnglesClient } from './AnglesClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Angle library | LeadIntel',
  description: 'Save, reuse, and iterate outbound angles with variants.',
  robots: { index: false, follow: false },
}

export default async function AngleLibraryPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?mode=signin&redirect=/angles')

  let subscriptionTier: 'free' | 'pro' = 'free'
  try {
    subscriptionTier = await getPlan(supabase as Parameters<typeof getPlan>[0], user.id)
  } catch {
    subscriptionTier = 'free'
  }

  const buildInfo = getBuildInfo()
  return (
    <PlanProvider initialPlan={subscriptionTier} initialBuildInfo={buildInfo}>
      <AnglesClient />
    </PlanProvider>
  )
}

