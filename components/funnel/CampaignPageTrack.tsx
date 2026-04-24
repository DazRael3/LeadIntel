'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

export function CampaignPageTrack(): null {
  useEffect(() => {
    track('demo_started', { source: 'campaign_page_view' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
