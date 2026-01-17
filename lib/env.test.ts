/**
 * Environment Variable Validation Tests
 * 
 * Tests for lib/env.ts schema validation and type safety.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'

// Mock process.env for testing
const originalEnv = process.env

describe('env schema validation', () => {
  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv
  })

  describe('clientEnvSchema', () => {
    it('should validate valid client environment variables', () => {
      const schema = z.object({
        NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key required'),
        NEXT_PUBLIC_SUPABASE_DB_SCHEMA: z.string().default('api'),
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_', 'Invalid Stripe publishable key format'),
        NEXT_PUBLIC_SITE_URL: z.string().url().optional().or(z.literal('')),
        ALLOWED_ORIGINS: z.string().optional(),
      })

      const valid = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        NEXT_PUBLIC_SUPABASE_DB_SCHEMA: 'api',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_1234567890',
        NEXT_PUBLIC_SITE_URL: 'https://app.example.com',
      }

      const result = schema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co')
        expect(result.data.NEXT_PUBLIC_SUPABASE_DB_SCHEMA).toBe('api')
      }
    })

    it('should reject invalid Supabase URL', () => {
      const schema = z.object({
        NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
        NEXT_PUBLIC_SUPABASE_DB_SCHEMA: z.string().default('api'),
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
        NEXT_PUBLIC_SITE_URL: z.string().url().optional().or(z.literal('')),
        ALLOWED_ORIGINS: z.string().optional(),
      })

      const invalid = {
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key',
        NEXT_PUBLIC_SUPABASE_DB_SCHEMA: 'api',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
      }

      const result = schema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid Supabase URL')
      }
    })

    it('should reject invalid Stripe publishable key format', () => {
      const schema = z.object({
        NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
        NEXT_PUBLIC_SUPABASE_DB_SCHEMA: z.string().default('api'),
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_', 'Invalid Stripe publishable key format'),
        NEXT_PUBLIC_SITE_URL: z.string().url().optional().or(z.literal('')),
        ALLOWED_ORIGINS: z.string().optional(),
      })

      const invalid = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key',
        NEXT_PUBLIC_SUPABASE_DB_SCHEMA: 'api',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'sk_test_123', // Wrong prefix
      }

      const result = schema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid Stripe publishable key format')
      }
    })

    it('should use default for NEXT_PUBLIC_SUPABASE_DB_SCHEMA', () => {
      const schema = z.object({
        NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
        NEXT_PUBLIC_SUPABASE_DB_SCHEMA: z.string().default('api'),
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
        NEXT_PUBLIC_SITE_URL: z.string().url().optional().or(z.literal('')),
        ALLOWED_ORIGINS: z.string().optional(),
      })

      const valid = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key',
        // NEXT_PUBLIC_SUPABASE_DB_SCHEMA omitted
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
      }

      const result = schema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.NEXT_PUBLIC_SUPABASE_DB_SCHEMA).toBe('api')
      }
    })
  })

  describe('serverEnvSchema', () => {
    it('should validate valid server environment variables', () => {
      const schema = z.object({
        SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key required'),
        SUPABASE_DB_SCHEMA: z.string().optional(),
        SUPABASE_DB_SCHEMA_FALLBACK: z.string().default('api'),
        STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'Invalid Stripe secret key format'),
        STRIPE_PRICE_ID: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
        STRIPE_PRICE_ID_PRO: z.string().startsWith('price_', 'Invalid Stripe price ID format').optional(),
        STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'Invalid Stripe webhook secret format'),
        OPENAI_API_KEY: z.string().startsWith('sk-', 'Invalid OpenAI API key format'),
        RESEND_API_KEY: z.string().startsWith('re_', 'Invalid Resend API key format').optional(),
        RESEND_FROM_EMAIL: z.string().email('Invalid Resend from email').optional(),
        CLEARBIT_REVEAL_API_KEY: z.string().optional(),
        CLEARBIT_API_KEY: z.string().optional(),
        HUNTER_API_KEY: z.string().optional(),
        NEWS_API_KEY: z.string().optional(),
        ZAPIER_WEBHOOK_URL: z.string().url().optional(),
        ADMIN_DIGEST_SECRET: z.string().optional(),
        DEV_SEED_SECRET: z.string().optional(),
        UPSTASH_REDIS_REST_URL: z.string().url().optional(),
        UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      })

      const valid = {
        SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        STRIPE_SECRET_KEY: 'sk_test_1234567890',
        STRIPE_WEBHOOK_SECRET: 'whsec_1234567890',
        OPENAI_API_KEY: 'sk-1234567890abcdef',
        NODE_ENV: 'production',
      }

      const result = schema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('should reject invalid Stripe secret key format', () => {
      const schema = z.object({
        SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
        STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'Invalid Stripe secret key format'),
        STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
        OPENAI_API_KEY: z.string().startsWith('sk-'),
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      })

      const invalid = {
        SUPABASE_SERVICE_ROLE_KEY: 'key',
        STRIPE_SECRET_KEY: 'pk_test_123', // Wrong prefix
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        OPENAI_API_KEY: 'sk-123',
        NODE_ENV: 'production',
      }

      const result = schema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid Stripe secret key format')
      }
    })

    it('should reject invalid OpenAI API key format', () => {
      const schema = z.object({
        SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
        STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
        STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
        OPENAI_API_KEY: z.string().startsWith('sk-', 'Invalid OpenAI API key format'),
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      })

      const invalid = {
        SUPABASE_SERVICE_ROLE_KEY: 'key',
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        OPENAI_API_KEY: 'sk_123', // Wrong format (should be sk-)
        NODE_ENV: 'production',
      }

      const result = schema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid OpenAI API key format')
      }
    })

    it('should use default for NODE_ENV', () => {
      const schema = z.object({
        SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
        STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
        STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
        OPENAI_API_KEY: z.string().startsWith('sk-'),
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
      })

      const valid = {
        SUPABASE_SERVICE_ROLE_KEY: 'key',
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_123',
        OPENAI_API_KEY: 'sk-123',
        // NODE_ENV omitted
      }

      const result = schema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('development')
      }
    })
  })
})
