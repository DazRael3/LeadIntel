'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

export function PageViewTrack(props: { event: string; props?: Record<string, unknown> }) {
  useEffect(() => {
    track(props.event, props.props)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: fire once per mount
  }, [])
  return null
}

