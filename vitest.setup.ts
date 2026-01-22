/**
 * Vitest Global Setup
 * 
 * Runs before all tests. Use for global mocks and setup.
 */

import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock external services to avoid requiring API keys in tests
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
  AuthApiError: class AuthApiError extends Error {
    status?: number
    constructor(message: string, status?: number) {
      super(message)
      this.name = 'AuthApiError'
      this.status = status
    }
  },
}))

vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    customers: {
      create: vi.fn(() => Promise.resolve({ id: 'cus_test123' })),
      retrieve: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(() => Promise.resolve({ url: 'https://checkout.stripe.com/test' })),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(() => Promise.resolve({ url: 'https://billing.stripe.com/test' })),
      },
    },
    webhooks: {
      constructEvent: vi.fn((body, signature, secret) => ({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test123' } },
      })),
    },
  })),
}))

vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: vi.fn(() =>
          Promise.resolve({
            choices: [{ message: { content: 'Generated content' } }],
          })
        ),
      },
    },
  })),
}))

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn(() => Promise.resolve({ data: { id: 'email_123' }, error: null })),
    },
  })),
}))

// Set minimal environment variables before any imports
// This prevents env validation from failing during tests
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || 'api'
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123'
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123'
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test123'
process.env.RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || 'test-resend-webhook-secret'
process.env.CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret-123456'
process.env.CRON_SIGNING_SECRET = process.env.CRON_SIGNING_SECRET || 'test-cron-signing-secret-123456'
process.env.SENTRY_DSN = process.env.SENTRY_DSN || ''
process.env.SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || 'test'
process.env.HEALTH_CHECK_EXTERNAL = process.env.HEALTH_CHECK_EXTERNAL || '0'
process.env.FEATURE_AUTOPILOT_ENABLED = process.env.FEATURE_AUTOPILOT_ENABLED || 'true'
process.env.FEATURE_RESEND_WEBHOOK_ENABLED = process.env.FEATURE_RESEND_WEBHOOK_ENABLED || 'true'
process.env.FEATURE_STRIPE_WEBHOOK_ENABLED = process.env.FEATURE_STRIPE_WEBHOOK_ENABLED || 'true'
process.env.FEATURE_CLEARBIT_ENABLED = process.env.FEATURE_CLEARBIT_ENABLED || 'true'
process.env.FEATURE_ZAPIER_PUSH_ENABLED = process.env.FEATURE_ZAPIER_PUSH_ENABLED || 'true'
// Set NODE_ENV only if not already set (it's read-only in some contexts)
if (!process.env.NODE_ENV) {
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true, configurable: true })
}
// Set Upstash env vars for tests (prevents validation errors)
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://example.com'
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'test-token'

// Suppress console warnings in tests (can be enabled for debugging)
// vi.spyOn(console, 'warn').mockImplementation(() => {})
