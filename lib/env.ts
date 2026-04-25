/**
 * Environment Variable Validation
 * 
 * Uses Zod to validate and type-check environment variables at startup.
 * Separates server-only secrets from client-safe public variables.
 * 
 * IMPORTANT: Server-only variables are NEVER exposed to client bundles.
 * Only NEXT_PUBLIC_* variables are available to client code.
 */

import { z } from 'zod'
import { isTestLikeEnv } from '@/lib/runtimeFlags'

function isNodeProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production' && !isTestLikeEnv()
}

function isStrictProductionEnv(): boolean {
  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV ?? '').trim().toLowerCase()
  return isNodeProductionEnv() && appEnv === 'production'
}

function isEnabledFlag(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true'
}

function isDisabledFlag(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '0' || normalized === 'false'
}

function hasNonEmptyValue(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function parseCsvEmails(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry.includes('@') && entry.includes('.'))
}

function requiredInProduction<T extends z.ZodTypeAny>(schema: T): z.ZodTypeAny {
  // In production we enforce strict env validation for ops safety.
  // In test-like environments (unit/E2E/CI), allow missing secrets so the app can run
  // with in-memory shims and without external integrations.
  // Preview/staging should behave like production in terms of URL/origin safety,
  // but MUST NOT require every integration secret globally (feature-scoped).
  return isNodeProductionEnv() ? schema : schema.optional()
}

const publicAppEnvSchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''),
  z.enum(['development', 'staging', 'production']).or(z.literal(''))
)

const siteUrlSchema = z
  .preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().url().or(z.literal('')))
  .refine((val) => process.env.NODE_ENV !== 'production' || isTestLikeEnv() || val.length > 0, {
    message: 'NEXT_PUBLIC_SITE_URL is required in production',
  })

const publicSupabaseUrlSchema = z
  .preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().url().or(z.literal('')))
  .refine((val) => process.env.NODE_ENV !== 'production' || isTestLikeEnv() || val.length > 0, {
    message: 'NEXT_PUBLIC_SUPABASE_URL is required in production',
  })

const publicSupabaseAnonKeySchema = z
  .preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().min(1).or(z.literal('')))
  .refine((val) => process.env.NODE_ENV !== 'production' || isTestLikeEnv() || val.length > 0, {
    message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required in production',
  })

const publicStripePublishableKeySchema = z
  .preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().startsWith('pk_').or(z.literal('')))
  .refine((val) => process.env.NODE_ENV !== 'production' || isTestLikeEnv() || val.length > 0, {
    message: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required in production',
  })

/**
 * Client-safe environment variables (NEXT_PUBLIC_* only)
 * These are exposed to the browser and must not contain secrets.
 */
const clientEnvSchema = z.object({
  // Supabase (public keys only)
  NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrlSchema,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: publicSupabaseAnonKeySchema,
  NEXT_PUBLIC_SUPABASE_DB_SCHEMA: z.string().default('api'),
  
  // Stripe (publishable key only)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: publicStripePublishableKeySchema,
  
  // Application
  NEXT_PUBLIC_SITE_URL: siteUrlSchema,
  NEXT_PUBLIC_APP_ENV: publicAppEnvSchema,
  // Debug UI (optional): if "true", show /api/whoami debug panel in dashboard.
  NEXT_PUBLIC_ENABLE_DEBUG_UI: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  // Autopilot UI (optional): if "true", show Autopilot section in Settings.
  NEXT_PUBLIC_ENABLE_AUTOPILOT_UI: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  // Client analytics (optional): when enabled, client will POST a few high-signal events.
  NEXT_PUBLIC_ANALYTICS_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  // Optional retargeting pixel IDs (client-safe identifiers).
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  NEXT_PUBLIC_TIKTOK_PIXEL_ID: z.string().optional(),
  // Optional public A/B controls for acquisition surfaces.
  NEXT_PUBLIC_AB_LANDING_HEADLINE: z.string().optional(),
  NEXT_PUBLIC_AB_LANDING_CTA: z.string().optional(),
  NEXT_PUBLIC_AB_PRICING_COPY: z.string().optional(),
  // CORS/Origin validation (comma-separated list of allowed origins)
  // Example: "https://app.example.com,https://www.example.com"
  ALLOWED_ORIGINS: z.string().optional(),
})

/**
 * Server-only environment variables (secrets, never exposed to client)
 * These are only available in server-side code (API routes, server components).
 */
const serverEnvSchema = z
  .object({
  // Public env (validated here too so serverEnv can be a single source for ops checks)
  NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrlSchema,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: publicSupabaseAnonKeySchema,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: publicStripePublishableKeySchema,
  NEXT_PUBLIC_SITE_URL: siteUrlSchema,
  NEXT_PUBLIC_APP_ENV: publicAppEnvSchema,

  // Supabase (server-only secrets)
  // Service role is required for key background/admin paths, but we do not hard-require it
  // globally in preview/staging to keep public boot predictable. Feature boundaries enforce it.
  SUPABASE_SERVICE_ROLE_KEY: requiredInProduction(z.string().min(1, 'Supabase service role key required')),
  SUPABASE_DB_SCHEMA: z.string().optional(),
  SUPABASE_DB_SCHEMA_FALLBACK: z.string().default('api'),
  
  // Stripe (server-only secrets)
  // Stripe is feature-scoped; do not require globally except in production boot.
  STRIPE_SECRET_KEY: requiredInProduction(z.string().startsWith('sk_', 'Invalid Stripe secret key format')),
  STRIPE_PRICE_ID: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  STRIPE_PRICE_ID_PRO: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  STRIPE_PRICE_ID_TEAM: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  // Optional additional price IDs (multi-tier / annual / seats). All optional for backward compatibility.
  STRIPE_PRICE_ID_CLOSER_ANNUAL: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  STRIPE_PRICE_ID_CLOSER_PLUS: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  STRIPE_PRICE_ID_TEAM_ANNUAL: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  STRIPE_PRICE_ID_TEAM_BASE: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  STRIPE_PRICE_ID_TEAM_BASE_ANNUAL: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  STRIPE_PRICE_ID_TEAM_SEAT: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  STRIPE_PRICE_ID_TEAM_SEAT_ANNUAL: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  // Webhook secret is only required if webhook processing is enabled; enforce at route boundary.
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'Invalid Stripe webhook secret format').optional(),
  
  // OpenAI
  // OpenAI is feature-scoped; enforce at generation boundaries.
  OPENAI_API_KEY: z.string().startsWith('sk-', 'Invalid OpenAI API key format').optional(),
  
  // Resend
  RESEND_API_KEY: z.string().startsWith('re_', 'Invalid Resend API key format').optional(),
  RESEND_FROM_EMAIL: z.string().email('Invalid Resend from email').optional(),
  RESEND_REPLY_TO_EMAIL: z.string().email('Invalid Resend reply-to email').optional(),
  EMAIL_BRAND_IMAGE_URL: z.string().url('Invalid email brand image URL').optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1, 'Resend webhook secret required').optional(),

  // Lifecycle / launch automation (optional)
  LIFECYCLE_EMAILS_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  // Comma-separated list of operator emails to notify (e.g. "owner@dazrael.com,ops@dazrael.com")
  LIFECYCLE_ADMIN_EMAILS: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().optional().default('')),
  // Optional override for feedback notifications; falls back to LIFECYCLE_ADMIN_EMAILS
  FEEDBACK_NOTIFICATION_EMAILS: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().optional().default('')),

  // Prospect watch engine (optional, internal/review-first)
  PROSPECT_WATCH_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  PROSPECT_WATCH_REVIEW_EMAILS: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().optional().default('')),
  PROSPECT_WATCH_DAILY_DIGEST_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  PROSPECT_WATCH_CONTENT_DIGEST_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  PROSPECT_WATCH_HIGH_PRIORITY_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  PROSPECT_WATCH_HIGH_PRIORITY_THRESHOLD: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return v
      const n = Number.parseInt(v, 10)
      return Number.isFinite(n) ? n : undefined
    },
    z.number().int().min(0).max(100).optional()
  ),
  // Comma-separated RSS feeds allowed for ingestion (approved source list).
  PROSPECT_WATCH_RSS_FEEDS: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().optional().default('')),
  // External send is OFF by default; requires explicit opt-in + admin-token send route.
  PROSPECT_WATCH_EXTERNAL_SEND_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  
  // Observability (Sentry)
  // Allow empty string so test/dev can explicitly disable without failing validation.
  SENTRY_DSN: z.string().url('Invalid SENTRY_DSN URL').optional().or(z.literal('')),
  SENTRY_ENVIRONMENT: z.string().optional(),
  HEALTH_CHECK_EXTERNAL: z.enum(['0', '1']).optional(),

  // Feature flags / kill switches (global)
  // Normalize to lowercase to avoid footguns like "TRUE"/"False" in production envs.
  FEATURE_AUTOPILOT_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  FEATURE_RESEND_WEBHOOK_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  FEATURE_STRIPE_WEBHOOK_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  FEATURE_CLEARBIT_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  FEATURE_ZAPIER_PUSH_ENABLED: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),

  // App-level trial flag (optional; does not change Stripe billing)
  ENABLE_APP_TRIAL: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),

  // Trial abuse hardening (optional): record soft fingerprints and use them to deny new trials.
  ENABLE_TRIAL_FINGERPRINTING: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),

  // Product analytics (optional): enable server-side logging into api.product_analytics.
  ENABLE_PRODUCT_ANALYTICS: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),

  // Platform API (optional; enforced at runtime when enabled)
  PLATFORM_API_KEY_PEPPER: z.string().min(16).optional(),
  EMBED_SIGNING_SECRET: z.string().min(32).optional(),

  // House accounts (optional): comma-separated list of emails treated as Closer without Stripe subscription.
  // Example: "owner@dazrael.com, ops@dazrael.com"
  HOUSE_CLOSER_EMAILS: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().optional().default('')),

  // Site health reporting (optional)
  ENABLE_SITE_REPORTS: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  SITE_REPORT_CRON_SECRET: z.string().optional(),
  ADMIN_USER_ID: z.string().uuid().optional(),

  // Demo behavior (optional): seed synthetic trigger events after pitch generation.
  ENABLE_DEMO_TRIGGER_EVENTS: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),

  // Trigger events ingestion provider (optional)
  TRIGGER_EVENTS_PROVIDER: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['none', 'newsapi', 'custom']).optional()
  ),
  // Trigger events ingestion providers (preferred): comma-separated list
  // Allowed: none, newsapi, finnhub, gdelt, crunchbase, rss
  TRIGGER_EVENTS_PROVIDERS: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true
        const allowed = new Set(['none', 'newsapi', 'finnhub', 'gdelt', 'crunchbase', 'rss'])
        return val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .every((name) => allowed.has(name))
      }, 'Invalid TRIGGER_EVENTS_PROVIDERS (allowed: none, newsapi, finnhub, gdelt, crunchbase, rss)')
  ),
  TRIGGER_EVENTS_DEBUG_LOGGING: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['0', '1', 'true', 'false']).optional()
  ),
  // Trigger events provider keys/config (all optional; providers noop when missing)
  NEWSAPI_API_KEY: z.string().optional(),
  FINNHUB_API_KEY: z.string().optional(),
  GDELT_BASE_URL: z.string().url().optional(),
  CRUNCHBASE_API_KEY: z.string().optional(),
  TRIGGER_EVENTS_RSS_FEEDS: z.string().optional(),
  TRIGGER_EVENTS_MAX_PER_PROVIDER: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return v
      const n = Number.parseInt(v, 10)
      return Number.isFinite(n) ? n : undefined
    },
    z.number().int().min(1).max(25).optional()
  ),
  // Cron secret for /api/trigger-events/ingest (optional)
  TRIGGER_EVENTS_CRON_SECRET: z.string().min(8).optional(),

  // Clearbit
  CLEARBIT_REVEAL_API_KEY: z.string().optional(),
  CLEARBIT_API_KEY: z.string().optional(),
  
  // Optional Third-Party Integrations
  HUNTER_API_KEY: z.string().optional(),
  NEWS_API_KEY: z.string().optional(),
  ZAPIER_WEBHOOK_URL: z.string().url().optional(),
  // SEC API: explicit user-agent is recommended by SEC.
  SEC_USER_AGENT: z.string().optional(),
  ADMIN_DIGEST_SECRET: z.string().optional(),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters').optional(),
  EXTERNAL_CRON_SECRET: z.string().min(16, 'EXTERNAL_CRON_SECRET must be at least 16 characters').optional(),
  CRON_SIGNING_SECRET: z.string().min(16, 'CRON_SIGNING_SECRET must be at least 16 characters').optional(),

  // Lifecycle email links (optional; falls back to NEXT_PUBLIC_SITE_URL or https://raelinfo.com)
  APP_URL: z.string().url().optional(),

  // Optional market data provider (server-side; falls back to deterministic mock quotes)
  MARKET_DATA_PROVIDER: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(['none', 'finnhub', 'polygon']).optional()
  ),
  MARKET_DATA_API_KEY: z.string().optional(),

  // Sources refresh automation (optional)
  SOURCES_REFRESH_LIMIT: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return v
      const n = Number.parseInt(v, 10)
      return Number.isFinite(n) ? n : undefined
    },
    z.number().int().min(1).max(200).optional()
  ),
  
  // Development
  DEV_SEED_SECRET: z.string().optional(),
  
  // Upstash Redis (for rate limiting)
  // Required in production, optional in development/E2E
  // In E2E mode, we allow any string (even invalid URLs) since we use in-memory limiter
  UPSTASH_REDIS_REST_URL: z.string().optional().refine(
    (val) => {
      // In E2E/test mode, allow any string (validation is bypassed)
      if (process.env.E2E === '1' || process.env.PLAYWRIGHT === '1' || process.env.NODE_ENV === 'test') {
        return true
      }
      // In production/dev, validate URL format if provided
      if (!val) return true // Optional
      try {
        new URL(val)
        return true
      } catch {
        return false
      }
    },
    { message: 'Invalid Upstash Redis URL' }
  ),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  
  // Node Environment (automatically set by Next.js)
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})
  .superRefine((env, ctx) => {
    if (!isNodeProductionEnv()) return

    if (!hasNonEmptyValue(env.NEXT_PUBLIC_APP_ENV)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NEXT_PUBLIC_APP_ENV'],
        message: 'NEXT_PUBLIC_APP_ENV must be set in production (development|staging|production).',
      })
      return
    }

    if (!isStrictProductionEnv()) return

    // Checkout correctness in production: /pricing exposes monthly + annual toggles
    // for Pro, Pro+, and Agency. Missing IDs would cause runtime CHECKOUT_NOT_CONFIGURED.
    const hasProMonthly = hasNonEmptyValue(env.STRIPE_PRICE_ID_PRO) || hasNonEmptyValue(env.STRIPE_PRICE_ID)
    if (!hasProMonthly) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_PRICE_ID_PRO'],
        message: 'Missing production Pro monthly Stripe price (set STRIPE_PRICE_ID_PRO or STRIPE_PRICE_ID).',
      })
    }

    if (!hasNonEmptyValue(env.STRIPE_PRICE_ID_CLOSER_ANNUAL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_PRICE_ID_CLOSER_ANNUAL'],
        message: 'Missing production Pro annual Stripe price.',
      })
    }

    if (!hasNonEmptyValue(env.STRIPE_PRICE_ID_CLOSER_PLUS)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_PRICE_ID_CLOSER_PLUS'],
        message: 'Missing production Pro+ monthly Stripe price.',
      })
    }

    if (!hasNonEmptyValue(env.STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL'],
        message: 'Missing production Pro+ annual Stripe price.',
      })
    }

    const hasTeamMonthly =
      hasNonEmptyValue(env.STRIPE_PRICE_ID_TEAM) ||
      (hasNonEmptyValue(env.STRIPE_PRICE_ID_TEAM_BASE) && hasNonEmptyValue(env.STRIPE_PRICE_ID_TEAM_SEAT))
    if (!hasTeamMonthly) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_PRICE_ID_TEAM'],
        message:
          'Missing production Agency monthly Stripe price (set STRIPE_PRICE_ID_TEAM or both STRIPE_PRICE_ID_TEAM_BASE + STRIPE_PRICE_ID_TEAM_SEAT).',
      })
    }

    const hasTeamAnnual =
      hasNonEmptyValue(env.STRIPE_PRICE_ID_TEAM_ANNUAL) ||
      (hasNonEmptyValue(env.STRIPE_PRICE_ID_TEAM_BASE_ANNUAL) &&
        hasNonEmptyValue(env.STRIPE_PRICE_ID_TEAM_SEAT_ANNUAL))
    if (!hasTeamAnnual) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_PRICE_ID_TEAM_ANNUAL'],
        message:
          'Missing production Agency annual Stripe price (set STRIPE_PRICE_ID_TEAM_ANNUAL or both STRIPE_PRICE_ID_TEAM_BASE_ANNUAL + STRIPE_PRICE_ID_TEAM_SEAT_ANNUAL).',
      })
    }

    // Stripe webhook processing defaults to enabled unless explicitly disabled.
    // Require signature secret when webhook processing is active.
    const stripeWebhookDisabled = isDisabledFlag(env.FEATURE_STRIPE_WEBHOOK_ENABLED)
    if (!stripeWebhookDisabled && !hasNonEmptyValue(env.STRIPE_WEBHOOK_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_WEBHOOK_SECRET'],
        message: 'Missing STRIPE_WEBHOOK_SECRET while Stripe webhook processing is enabled.',
      })
    }

    // AI generation is a core production surface.
    if (!hasNonEmptyValue(env.OPENAI_API_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OPENAI_API_KEY'],
        message: 'OPENAI_API_KEY is required in production.',
      })
    }

    // Email checks:
    // - If either Resend var is set, enforce the pair.
    // - If lifecycle sends are enabled, enforce full Resend config.
    const hasResendKey = hasNonEmptyValue(env.RESEND_API_KEY)
    const hasResendFrom = hasNonEmptyValue(env.RESEND_FROM_EMAIL)
    if (hasResendKey && !hasResendFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_FROM_EMAIL'],
        message: 'RESEND_FROM_EMAIL is required when RESEND_API_KEY is set.',
      })
    }
    if (hasResendFrom && !hasResendKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY is required when RESEND_FROM_EMAIL is set.',
      })
    }

    const lifecycleEmailEnabled = isEnabledFlag(env.LIFECYCLE_EMAILS_ENABLED)
    const lifecycleAdminNotifyEnabled = isEnabledFlag(env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED)
    if ((lifecycleEmailEnabled || lifecycleAdminNotifyEnabled) && (!hasResendKey || !hasResendFrom)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['LIFECYCLE_EMAILS_ENABLED'],
        message:
          'Lifecycle email features require RESEND_API_KEY and RESEND_FROM_EMAIL in production.',
      })
    }
    if (lifecycleAdminNotifyEnabled && parseCsvEmails(env.LIFECYCLE_ADMIN_EMAILS).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['LIFECYCLE_ADMIN_EMAILS'],
        message:
          'LIFECYCLE_ADMIN_EMAILS must contain at least one valid email when LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED is true.',
      })
    }
  })

export type ServerEnv = z.infer<typeof serverEnvSchema>

/**
 * Memoized server environment getter.
 * Builds once when first accessed from a server context.
 */

let cachedServerEnv: ServerEnv | undefined

function buildServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error(
      'serverEnv() cannot be called in client-side code. ' +
      'Use clientEnv() for client-safe variables.'
    )
  }

  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_DB_SCHEMA: process.env.SUPABASE_DB_SCHEMA,
    SUPABASE_DB_SCHEMA_FALLBACK: process.env.SUPABASE_DB_SCHEMA_FALLBACK,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
    STRIPE_PRICE_ID_PRO: process.env.STRIPE_PRICE_ID_PRO,
    STRIPE_PRICE_ID_TEAM: process.env.STRIPE_PRICE_ID_TEAM,
    STRIPE_PRICE_ID_CLOSER_ANNUAL: process.env.STRIPE_PRICE_ID_CLOSER_ANNUAL,
    STRIPE_PRICE_ID_CLOSER_PLUS: process.env.STRIPE_PRICE_ID_CLOSER_PLUS,
    STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL: process.env.STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL,
    STRIPE_PRICE_ID_TEAM_ANNUAL: process.env.STRIPE_PRICE_ID_TEAM_ANNUAL,
    STRIPE_PRICE_ID_TEAM_BASE: process.env.STRIPE_PRICE_ID_TEAM_BASE,
    STRIPE_PRICE_ID_TEAM_BASE_ANNUAL: process.env.STRIPE_PRICE_ID_TEAM_BASE_ANNUAL,
    STRIPE_PRICE_ID_TEAM_SEAT: process.env.STRIPE_PRICE_ID_TEAM_SEAT,
    STRIPE_PRICE_ID_TEAM_SEAT_ANNUAL: process.env.STRIPE_PRICE_ID_TEAM_SEAT_ANNUAL,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    RESEND_REPLY_TO_EMAIL: process.env.RESEND_REPLY_TO_EMAIL,
    EMAIL_BRAND_IMAGE_URL: process.env.EMAIL_BRAND_IMAGE_URL,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    LIFECYCLE_EMAILS_ENABLED: process.env.LIFECYCLE_EMAILS_ENABLED,
    LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED: process.env.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED,
    LIFECYCLE_ADMIN_EMAILS: process.env.LIFECYCLE_ADMIN_EMAILS,
    FEEDBACK_NOTIFICATION_EMAILS: process.env.FEEDBACK_NOTIFICATION_EMAILS,
    PROSPECT_WATCH_ENABLED: process.env.PROSPECT_WATCH_ENABLED,
    PROSPECT_WATCH_REVIEW_EMAILS: process.env.PROSPECT_WATCH_REVIEW_EMAILS,
    PROSPECT_WATCH_DAILY_DIGEST_ENABLED: process.env.PROSPECT_WATCH_DAILY_DIGEST_ENABLED,
    PROSPECT_WATCH_CONTENT_DIGEST_ENABLED: process.env.PROSPECT_WATCH_CONTENT_DIGEST_ENABLED,
    PROSPECT_WATCH_HIGH_PRIORITY_ENABLED: process.env.PROSPECT_WATCH_HIGH_PRIORITY_ENABLED,
    PROSPECT_WATCH_HIGH_PRIORITY_THRESHOLD: process.env.PROSPECT_WATCH_HIGH_PRIORITY_THRESHOLD,
    PROSPECT_WATCH_RSS_FEEDS: process.env.PROSPECT_WATCH_RSS_FEEDS,
    PROSPECT_WATCH_EXTERNAL_SEND_ENABLED: process.env.PROSPECT_WATCH_EXTERNAL_SEND_ENABLED,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
    CLEARBIT_REVEAL_API_KEY: process.env.CLEARBIT_REVEAL_API_KEY,
    CLEARBIT_API_KEY: process.env.CLEARBIT_API_KEY,
    HUNTER_API_KEY: process.env.HUNTER_API_KEY,
    NEWS_API_KEY: process.env.NEWS_API_KEY,
    ZAPIER_WEBHOOK_URL: process.env.ZAPIER_WEBHOOK_URL,
    SEC_USER_AGENT: process.env.SEC_USER_AGENT,
    FEATURE_AUTOPILOT_ENABLED: process.env.FEATURE_AUTOPILOT_ENABLED,
    FEATURE_RESEND_WEBHOOK_ENABLED: process.env.FEATURE_RESEND_WEBHOOK_ENABLED,
    FEATURE_STRIPE_WEBHOOK_ENABLED: process.env.FEATURE_STRIPE_WEBHOOK_ENABLED,
    FEATURE_CLEARBIT_ENABLED: process.env.FEATURE_CLEARBIT_ENABLED,
    FEATURE_ZAPIER_PUSH_ENABLED: process.env.FEATURE_ZAPIER_PUSH_ENABLED,
    ENABLE_APP_TRIAL: process.env.ENABLE_APP_TRIAL,
    ENABLE_TRIAL_FINGERPRINTING: process.env.ENABLE_TRIAL_FINGERPRINTING,
    ENABLE_PRODUCT_ANALYTICS: process.env.ENABLE_PRODUCT_ANALYTICS,
    PLATFORM_API_KEY_PEPPER: process.env.PLATFORM_API_KEY_PEPPER,
    EMBED_SIGNING_SECRET: process.env.EMBED_SIGNING_SECRET,
    HOUSE_CLOSER_EMAILS: process.env.HOUSE_CLOSER_EMAILS,
    ENABLE_SITE_REPORTS: process.env.ENABLE_SITE_REPORTS,
    SITE_REPORT_CRON_SECRET: process.env.SITE_REPORT_CRON_SECRET,
    ADMIN_USER_ID: process.env.ADMIN_USER_ID,
    ENABLE_DEMO_TRIGGER_EVENTS: process.env.ENABLE_DEMO_TRIGGER_EVENTS,
    TRIGGER_EVENTS_PROVIDER: process.env.TRIGGER_EVENTS_PROVIDER,
    TRIGGER_EVENTS_PROVIDERS: process.env.TRIGGER_EVENTS_PROVIDERS,
    TRIGGER_EVENTS_DEBUG_LOGGING: process.env.TRIGGER_EVENTS_DEBUG_LOGGING,
    NEWSAPI_API_KEY: process.env.NEWSAPI_API_KEY,
    FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
    GDELT_BASE_URL: process.env.GDELT_BASE_URL,
    CRUNCHBASE_API_KEY: process.env.CRUNCHBASE_API_KEY,
    TRIGGER_EVENTS_RSS_FEEDS: process.env.TRIGGER_EVENTS_RSS_FEEDS,
    TRIGGER_EVENTS_MAX_PER_PROVIDER: process.env.TRIGGER_EVENTS_MAX_PER_PROVIDER,
    TRIGGER_EVENTS_CRON_SECRET: process.env.TRIGGER_EVENTS_CRON_SECRET,
    ADMIN_DIGEST_SECRET: process.env.ADMIN_DIGEST_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    EXTERNAL_CRON_SECRET: process.env.EXTERNAL_CRON_SECRET,
    CRON_SIGNING_SECRET: process.env.CRON_SIGNING_SECRET,
    APP_URL: process.env.APP_URL,
    MARKET_DATA_PROVIDER: process.env.MARKET_DATA_PROVIDER,
    MARKET_DATA_API_KEY: process.env.MARKET_DATA_API_KEY,
    SOURCES_REFRESH_LIMIT: process.env.SOURCES_REFRESH_LIMIT,
    HEALTH_CHECK_EXTERNAL: process.env.HEALTH_CHECK_EXTERNAL,
    DEV_SEED_SECRET: process.env.DEV_SEED_SECRET,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
  })

  if (!parsed.success) {
    console.error('❌ Invalid server environment variables:')
    parsed.error.issues.forEach((issue) => {
      const path = issue.path.join('.')
      const message = issue.message
      console.error(`  - ${path}: ${message}`)

      if (path.includes('STRIPE_SECRET_KEY') && !process.env.STRIPE_SECRET_KEY) {
        console.error('    💡 Get your Stripe secret key from: https://dashboard.stripe.com/apikeys')
      }
      if (path.includes('OPENAI_API_KEY') && !process.env.OPENAI_API_KEY) {
        console.error('    💡 Get your OpenAI API key from: https://platform.openai.com/api-keys')
      }
      if (path.includes('SUPABASE_SERVICE_ROLE_KEY') && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('    💡 Get your Supabase service role key from: Supabase Dashboard → Settings → API')
      }
      if (path.includes('UPSTASH') && !process.env.UPSTASH_REDIS_REST_URL) {
        console.error('    💡 Get your Upstash Redis credentials from: https://console.upstash.com/')
      }
    })

    throw new Error('Invalid server environment variables. Check console for details.')
  }

  return parsed.data
}

function resolveServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = buildServerEnv()
  }
  return cachedServerEnv
}

export function getServerEnv(): ServerEnv {
  return resolveServerEnv()
}

export const serverEnv = new Proxy({} as ServerEnv, {
  get(_, prop) {
    if (typeof prop === 'symbol') {
      return Reflect.get(resolveServerEnv(), prop)
    }
    return resolveServerEnv()[prop as keyof ServerEnv]
  }
})

/**
 * Validated client environment variables
 * Safe to use in client-side code (browser)
 */
let cachedClientEnv: ClientEnv | null = null

function buildClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_DB_SCHEMA: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_ENABLE_DEBUG_UI: process.env.NEXT_PUBLIC_ENABLE_DEBUG_UI,
    NEXT_PUBLIC_ENABLE_AUTOPILOT_UI: process.env.NEXT_PUBLIC_ENABLE_AUTOPILOT_UI,
    NEXT_PUBLIC_ANALYTICS_ENABLED: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  })

  if (!parsed.success) {
    console.error('❌ Invalid client environment variables:')
    parsed.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    })
    throw new Error('Invalid client environment variables')
  }

  return parsed.data
}

function resolveClientEnv(): ClientEnv {
  if (!cachedClientEnv) {
    cachedClientEnv = buildClientEnv()
  }
  return cachedClientEnv
}

export function getClientEnv(): ClientEnv {
  return resolveClientEnv()
}

export const clientEnv = new Proxy({} as ClientEnv, {
  get(_, prop) {
    if (typeof prop === 'symbol') {
      return Reflect.get(resolveClientEnv(), prop)
    }
    return resolveClientEnv()[prop as keyof ClientEnv]
  },
})

/**
 * Type exports for use in other files
 */
export type ClientEnv = z.infer<typeof clientEnvSchema>
// ServerEnv type already exported above

/**
 * Legacy functions for backward compatibility
 * @deprecated Use serverEnv.OPENAI_API_KEY instead
 */
export function requireEnv(name: string): string {
  if (typeof window !== 'undefined') {
    throw new Error('requireEnv() cannot be called in client-side code')
  }

  const value = serverEnv[name as keyof ServerEnv] as string | undefined
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Please set ${name} in your .env.local file.`
    )
  }
  return value
}

/**
 * @deprecated Use serverEnv or clientEnv instead
 */
export function getEnv(name: string, defaultValue?: string): string | undefined {
  if (name.startsWith('NEXT_PUBLIC_')) {
    return (clientEnv[name as keyof ClientEnv] as string | undefined) || defaultValue
  }

  if (typeof window !== 'undefined') {
    console.warn(`getEnv() called with server-only variable "${name}" in client code. This will return undefined.`)
    return defaultValue
  }

  return (serverEnv[name as keyof ServerEnv] as string | undefined) || defaultValue
}

/**
 * Type exports for use in other files
 */
