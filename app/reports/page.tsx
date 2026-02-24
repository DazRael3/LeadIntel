import React from 'react'
import { redirect } from 'next/navigation'
import { ReportsHubContent } from './ReportsHubContent'
import { loadReportsHubPageData } from './loadReportsHubPageData'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const { user, tier, reports } = await loadReportsHubPageData()

  if (!user || !tier) {
    redirect('/login?mode=signin&redirect=/reports')
  }

  return <ReportsHubContent tier={tier} reports={reports} />
}

