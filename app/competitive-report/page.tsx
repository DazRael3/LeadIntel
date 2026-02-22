import React from 'react'
import type { Metadata } from 'next'
import { CompetitiveReportContent } from './CompetitiveReportContent'
import { loadCompetitiveReportPageData } from './loadCompetitiveReportPageData'

export const metadata: Metadata = {
  title: 'Competitive Intelligence Report | LeadIntel',
  description:
    'Learn how LeadIntel turns near real-time buying signals into AI-generated pitches, battlecards, and watchlists to help you create pipeline faster.',
}

export default async function CompetitiveReportPage() {
  const { user, tier, latestPitch } = await loadCompetitiveReportPageData()
  return <CompetitiveReportContent viewer={user ? { id: user.id } : null} tier={tier} latestPitch={latestPitch} />
}

