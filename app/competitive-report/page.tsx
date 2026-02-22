import React from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getPlanDetails, type PlanTier } from '@/lib/billing/plan'
import { getLatestPitchForUser } from '@/lib/services/pitches'
import { CompetitiveReportContent } from './CompetitiveReportContent'

export const metadata: Metadata = {
  title: 'Competitive Intelligence Report | LeadIntel',
  description:
    'Learn how LeadIntel turns near real-time buying signals into AI-generated pitches, battlecards, and watchlists to help you create pipeline faster.',
}

export default async function CompetitiveReportPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <CompetitiveReportContent viewer={null} tier={null} latestPitch={null} />
  }

  const details = await getPlanDetails(supabase as Parameters<typeof getPlanDetails>[0], user.id)
  const tier: PlanTier = details.plan === 'pro' ? 'closer' : 'starter'
  const latestPitch = await getLatestPitchForUser(supabase, user.id)

  return <CompetitiveReportContent viewer={{ id: user.id }} tier={tier} latestPitch={latestPitch} />
}

