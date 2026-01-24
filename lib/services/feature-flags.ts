import type { NextResponse } from 'next/server'
import { fail, ErrorCode } from '@/lib/api/http'
import { serverEnv } from '@/lib/env'
import { captureBreadcrumb, captureMessage } from '@/lib/observability/sentry'
import type { SupabaseClient } from '@supabase/supabase-js'

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

type TenantFlagRow = { feature: string; enabled: boolean }

async function getTenantOverride(
  supabase: SupabaseClient,
  tenantId: string,
  feature: FeatureName
): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('feature, enabled')
      .eq('user_id', tenantId)
      .eq('feature', feature)
      .maybeSingle()
    if (error || !data) return null
    const row = data as TenantFlagRow
    if (typeof row.enabled !== 'boolean') return null
    return row.enabled
  } catch {
    return null
  }
}

/**
 * Feature flag evaluation precedence:
 * 1) Global kill switch (env) OFF => always OFF
 * 2) Tenant override (DB) if present
 * 3) Global env ON if explicitly set
 * 4) Default ON
 */
export async function isFeatureEnabled(
  feature: FeatureName,
  options?: { tenantId?: string; supabase?: SupabaseClient }
): Promise<boolean> {
  try {
    const envKey = FEATURE_TO_ENV[feature]
    const raw = serverEnv[envKey]
    const envParsed = parseBooleanish(raw)

    // Global hard-off always wins (emergency kill switch).
    if (envParsed === false) return false

    if (options?.tenantId && options.supabase) {
      const overridden = await getTenantOverride(options.supabase, options.tenantId, feature)
      if (overridden !== null) return overridden
    }

    if (envParsed === true) return true
    return true
  } catch {
    // If anything goes wrong, fail OPEN for availability (operators can still disable via env).
    return true
  }
}

export function assertFeatureEnabled(
  feature: FeatureName,
  context?: {
    route?: string
    requestId?: string
    tenantId?: string
    mode?: 'cron' | 'user' | 'webhook'
    supabase?: SupabaseClient
  }
): Promise<NextResponse | null> {
  try {
    return (async () => {
      const enabled = await isFeatureEnabled(feature, { tenantId: context?.tenantId, supabase: context?.supabase })
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
    })()
  } catch {
    // Never block requests due to feature-flag system failure.
    return Promise.resolve(null)
  }
}

