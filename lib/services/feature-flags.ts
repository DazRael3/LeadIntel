import type { NextResponse } from 'next/server'
import { fail, ErrorCode } from '@/lib/api/http'
import { serverEnv } from '@/lib/env'
import { captureBreadcrumb, captureMessage } from '@/lib/observability/sentry'

export type FeatureName =
  | 'autopilot_sends'
  | 'resend_webhook'
  | 'stripe_webhook'
  | 'clearbit_enrichment'
  | 'zapier_push'

type FeatureEnvKey =
  | 'FEATURE_AUTOPILOT_ENABLED'
  | 'FEATURE_RESEND_WEBHOOK_ENABLED'
  | 'FEATURE_STRIPE_WEBHOOK_ENABLED'
  | 'FEATURE_CLEARBIT_ENABLED'
  | 'FEATURE_ZAPIER_PUSH_ENABLED'

const FEATURE_TO_ENV: Record<FeatureName, FeatureEnvKey> = {
  autopilot_sends: 'FEATURE_AUTOPILOT_ENABLED',
  resend_webhook: 'FEATURE_RESEND_WEBHOOK_ENABLED',
  stripe_webhook: 'FEATURE_STRIPE_WEBHOOK_ENABLED',
  clearbit_enrichment: 'FEATURE_CLEARBIT_ENABLED',
  zapier_push: 'FEATURE_ZAPIER_PUSH_ENABLED',
} as const

type Booleanish = '0' | '1' | 'true' | 'false'

function normalizeBooleanish(value: unknown): Booleanish | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (v === '0' || v === '1' || v === 'true' || v === 'false') return v
  return null
}

function parseBooleanish(value: unknown): boolean | null {
  const v = normalizeBooleanish(value)
  if (v === null) return null
  if (v === '1' || v === 'true') return true
  if (v === '0' || v === 'false') return false
  return null
}

export function isFeatureEnabled(feature: FeatureName, options?: { tenantId?: string }): boolean {
  try {
    const envKey = FEATURE_TO_ENV[feature]
    const raw = serverEnv[envKey]
    const parsed = parseBooleanish(raw)

    // Default is ON unless explicitly disabled.
    if (parsed === null) return true
    if (parsed === false) return false

    // Placeholder for future tenant overrides (DB-backed) without changing the signature.
    if (options?.tenantId) {
      return true
    }
    return true
  } catch {
    // If anything goes wrong, fail OPEN for availability (operators can still disable via env).
    return true
  }
}

export function assertFeatureEnabled(
  feature: FeatureName,
  context?: { route?: string; requestId?: string; tenantId?: string; mode?: 'cron' | 'user' | 'webhook' }
): NextResponse | null {
  try {
    const enabled = isFeatureEnabled(feature, { tenantId: context?.tenantId })
    if (enabled) return null

    captureBreadcrumb({
      category: 'feature_flag',
      level: 'warning',
      message: 'feature_disabled',
      data: {
        feature,
        route: context?.route,
        requestId: context?.requestId,
        mode: context?.mode,
      },
    })

    captureMessage('feature_kill_switch_engaged', {
      feature,
      route: context?.route,
      requestId: context?.requestId,
      mode: context?.mode,
    })

    return fail(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Feature temporarily disabled by configuration',
      { feature },
      { status: 503 },
      undefined,
      context?.requestId
    )
  } catch {
    // Never block requests due to feature-flag system failure.
    return null
  }
}

