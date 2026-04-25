'use client'

import { useEffect } from 'react'
import { initPostHog } from '@/lib/analytics/posthog-client'
import { initTrackingPixels } from '@/lib/analytics/pixels-client'

export function AnalyticsBootstrap() {
  useEffect(() => {
    initPostHog()
    initTrackingPixels()
  }, [])
  return null
}

