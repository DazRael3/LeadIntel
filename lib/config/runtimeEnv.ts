import { logger } from '@/lib/observability/logger'

export type AppEnv = 'development' | 'staging' | 'production'

function normalizeAppEnv(raw: unknown): AppEnv {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (v === 'production' || v === 'staging' || v === 'development') return v
  return 'development'
}

/**
 * App environment used for runtime safety checks.
 *
 * Set via `NEXT_PUBLIC_APP_ENV`:
 * - development: local dev (Stripe test keys OK)
 * - staging: preview/QA (Stripe test keys usually OK)
 * - production: live deployment (Stripe LIVE keys required; enforced by assertProdStripeConfig())
 */
export const APP_ENV: AppEnv = normalizeAppEnv(process.env.NEXT_PUBLIC_APP_ENV)

// Stripe
export const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY ?? '').trim()
// Keep compatibility with existing env var names used across the repo.
export const STRIPE_PRO_PRICE_ID = (process.env.STRIPE_PRICE_ID_PRO ?? process.env.STRIPE_PRICE_ID ?? '').trim()
export const STRIPE_TEAM_PRICE_ID = (process.env.STRIPE_PRICE_ID_TEAM ?? '').trim()

// Supabase
export const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

export function assertProdStripeConfig(): void {
  if (APP_ENV !== 'production') return

  const key = STRIPE_SECRET_KEY
  const isMissing = key.length === 0
  const isTestKey = key.startsWith('sk_test_')

  if (isMissing || isTestKey) {
    logger.error({
      level: 'error',
      scope: 'config',
      message: 'invalid_stripe_config',
      appEnv: APP_ENV,
      hasStripeSecretKey: !isMissing,
      stripeKeyKind: isMissing ? 'missing' : isTestKey ? 'test' : 'unknown',
    })
    throw new Error('Invalid Stripe configuration for production')
  }
}

export function assertSupabaseServiceRoleConfigured(): void {
  if (SUPABASE_SERVICE_ROLE_KEY) return
  logger.error({
    level: 'error',
    scope: 'config',
    message: 'supabase_service_role_missing',
    appEnv: APP_ENV,
  })
  throw new Error('Supabase service role is not configured')
}

export function hasSupabaseServiceRoleConfigured(): boolean {
  return Boolean(SUPABASE_SERVICE_ROLE_KEY)
}

