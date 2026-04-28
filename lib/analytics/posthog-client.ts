'use client'

import posthog from 'posthog-js'
import { getPosthogConfiguration } from '@/lib/observability/posthog-config'

let initialized = false

function isEnabled(): boolean {
  const enabled = (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED ?? '').trim().toLowerCase()
  return enabled === 'true' || enabled === '1'
}

export function initPostHog(): void {
  if (!isEnabled()) return
  if (initialized) return
  const cfg = getPosthogConfiguration()
  if (!cfg.analyticsCaptureConfigured || !cfg.host) return
  const key = (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '').trim()
  if (!key) return
  const host = cfg.host
  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    // Avoid collecting sensitive text by default.
    mask_all_text: true,
    mask_all_element_attributes: true,
  })

  initialized = true
}

export function captureClientEvent(eventName: string, props?: Record<string, unknown>): void {
  initPostHog()
  if (!initialized) return
  try {
    posthog.capture(eventName, props ?? {})
  } catch {
    // best-effort
  }
}

export function identifyClientUser(distinctId: string, props?: { email?: string | null }): void {
  initPostHog()
  if (!initialized) return
  try {
    posthog.identify(distinctId, props ?? {})
  } catch {
    // best-effort
  }
}

