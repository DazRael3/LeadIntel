'use client'

import { useEffect } from 'react'
import { initPostHog } from '@/lib/analytics/posthog-client'

export function AnalyticsBootstrap() {
  useEffect(() => {
    initPostHog()
  }, [])
  return null
}

