'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'
import { normalizeToFunnelEvent } from '@/lib/analytics/funnel-events'

export function PageViewTrack(props: { event: string; props?: Record<string, unknown> }) {
  useEffect(() => {
    const normalized = normalizeToFunnelEvent(props.event)
    track(normalized ?? props.event, props.props)
    if (props.event !== 'page_view') {
      track('page_view', { ...(props.props ?? {}), sourceEvent: props.event })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: fire once per mount
  }, [])
  return null
}

