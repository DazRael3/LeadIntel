'use client'

import { captureClientEvent } from '@/lib/analytics/posthog-client'

export function track(eventName: string, props?: Record<string, unknown>): void {
  const enabled = (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED ?? '').trim().toLowerCase()
  if (!(enabled === 'true' || enabled === '1')) return

  try {
    // Primary: external product analytics (PostHog) when configured.
    captureClientEvent(eventName, props)

    // Secondary: internal event log (requires auth; best-effort).
    void fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName, eventProps: props ?? {} }),
      keepalive: true,
    })
  } catch {
    // best-effort
  }
}

