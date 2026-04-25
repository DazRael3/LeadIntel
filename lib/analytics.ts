'use client'

import { captureClientEvent } from '@/lib/analytics/posthog-client'
import { canonicalFunnelEvent, sanitizeFunnelProps } from '@/lib/analytics/funnel-events'
import { trackRetargetingPixels } from '@/lib/analytics/pixels-client'

export function track(eventName: string, props?: Record<string, unknown>): void {
  const enabled = (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED ?? '').trim().toLowerCase()
  if (!(enabled === 'true' || enabled === '1')) return

  try {
    const canonical = canonicalFunnelEvent(eventName)
    const safeProps = sanitizeFunnelProps(props)
    const internalEventName = canonical ?? eventName

    // Primary: external product analytics (PostHog) when configured.
    captureClientEvent(internalEventName, safeProps)
    if (canonical && canonical !== eventName) {
      // Keep compatibility with existing dashboards while migrating to canonical taxonomy.
      captureClientEvent(eventName, safeProps)
    }

    // Secondary: internal event log (requires auth; best-effort).
    void fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: internalEventName,
        eventProps: {
          ...safeProps,
          ...(canonical && canonical !== eventName ? { aliasOf: eventName } : {}),
        },
      }),
      keepalive: true,
    })

    trackRetargetingPixels(internalEventName, safeProps)
  } catch {
    // best-effort
  }
}

