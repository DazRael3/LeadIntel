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

/**
 * Client-safe environment variables (NEXT_PUBLIC_* only)
 * These are exposed to the browser and must not contain secrets.
 */
const clientEnvSchema = z.object({
  // Supabase (public keys only)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key required'),
  NEXT_PUBLIC_SUPABASE_DB_SCHEMA: z.string().default('api'),
  
  // Stripe (publishable key only)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_', 'Invalid Stripe publishable key format'),
  
  // Application
  NEXT_PUBLIC_SITE_URL: z.string().url().optional().or(z.literal('')),
  // CORS/Origin validation (comma-separated list of allowed origins)
  // Example: "https://app.example.com,https://www.example.com"
  ALLOWED_ORIGINS: z.string().optional(),
})

/**
 * Server-only environment variables (secrets, never exposed to client)
 * These are only available in server-side code (API routes, server components).
 */
const serverEnvSchema = z.object({
  // Supabase (server-only secrets)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key required'),
  SUPABASE_DB_SCHEMA: z.string().optional(),
  SUPABASE_DB_SCHEMA_FALLBACK: z.string().default('api'),
  
  // Stripe (server-only secrets)
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'Invalid Stripe secret key format'),
  STRIPE_PRICE_ID: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  STRIPE_PRICE_ID_PRO: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'Invalid Stripe webhook secret format'),
  
  // OpenAI
  OPENAI_API_KEY: z.string().startsWith('sk-', 'Invalid OpenAI API key format'),
  
  // Resend
  RESEND_API_KEY: z.string().startsWith('re_', 'Invalid Resend API key format').optional(),
  RESEND_FROM_EMAIL: z.string().email('Invalid Resend from email').optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1, 'Resend webhook secret required').optional(),
  
  // Clearbit
  CLEARBIT_REVEAL_API_KEY: z.string().optional(),
  CLEARBIT_API_KEY: z.string().optional(),
  
  // Optional Third-Party Integrations
  HUNTER_API_KEY: z.string().optional(),
  NEWS_API_KEY: z.string().optional(),
  ZAPIER_WEBHOOK_URL: z.string().url().optional(),
  ADMIN_DIGEST_SECRET: z.string().optional(),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters').optional(),
  CRON_SIGNING_SECRET: z.string().min(16, 'CRON_SIGNING_SECRET must be at least 16 characters').optional(),
  
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

export type ServerEnv = z.infer<typeof serverEnvSchema>
/**
 * Combined schema for validation
 */
const envSchema = clientEnvSchema.merge(serverEnvSchema)

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
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_DB_SCHEMA: process.env.SUPABASE_DB_SCHEMA,
    SUPABASE_DB_SCHEMA_FALLBACK: process.env.SUPABASE_DB_SCHEMA_FALLBACK,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
    STRIPE_PRICE_ID_PRO: process.env.STRIPE_PRICE_ID_PRO,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    CLEARBIT_REVEAL_API_KEY: process.env.CLEARBIT_REVEAL_API_KEY,
    CLEARBIT_API_KEY: process.env.CLEARBIT_API_KEY,
    HUNTER_API_KEY: process.env.HUNTER_API_KEY,
    NEWS_API_KEY: process.env.NEWS_API_KEY,
    ZAPIER_WEBHOOK_URL: process.env.ZAPIER_WEBHOOK_URL,
    ADMIN_DIGEST_SECRET: process.env.ADMIN_DIGEST_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    CRON_SIGNING_SECRET: process.env.CRON_SIGNING_SECRET,
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
export const clientEnv = (() => {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_DB_SCHEMA: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
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
})()

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
