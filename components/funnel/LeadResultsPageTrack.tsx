'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

export function LeadResultsPageTrack(): null {
  useEffect(() => {
    track('lead_search_completed', { source: 'lead_results_page', stage: 'page_viewed' })
    track('results_viewed', { source: 'lead_results_page' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time page-view tracking
  }, [])
  return null
}
