import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration
 * 
 * Configured for both CI and local development.
 * Tests run against a local Next.js dev server.
 */

export default defineConfig({
  // Test directory
  testDir: './e2e',
  
  // Maximum time one test can run
  timeout: 30 * 1000,
  
  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: process.env.CI ? 'github' : 'html',
  
  // Shared settings for all projects
  use: {
    // Base URL for tests
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    
    // Collect trace on failure
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Action timeout
    actionTimeout: 10 * 1000,
    
    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    // Uncomment to test on other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run local dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
    // Set E2E environment variables to satisfy validation and enable test mode
    env: {
      E2E: '1',
      PLAYWRIGHT: '1',
      NEXT_PUBLIC_E2E: '1',
      NEXT_PUBLIC_PLAYWRIGHT: '1',
      UPSTASH_REDIS_REST_URL: 'https://example.com',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
      // Minimal env to satisfy env validation in middleware/server
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key',
      NEXT_PUBLIC_SUPABASE_DB_SCHEMA: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || 'api',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key',
      SUPABASE_DB_SCHEMA: process.env.SUPABASE_DB_SCHEMA || 'api',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-test123',
      RESEND_API_KEY: process.env.RESEND_API_KEY || 're_test123',
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'test@example.com',
      RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET || 'test-resend-webhook-secret',
      CRON_SECRET: process.env.CRON_SECRET || 'test-cron-secret-123456',
      CRON_SIGNING_SECRET: process.env.CRON_SIGNING_SECRET || 'test-cron-signing-secret-123456',
      SENTRY_DSN: process.env.SENTRY_DSN || '',
      SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT || 'test',
      HEALTH_CHECK_EXTERNAL: process.env.HEALTH_CHECK_EXTERNAL || '0',
      ADMIN_DIGEST_SECRET: process.env.ADMIN_DIGEST_SECRET || 'test-secret',
    },
  },
})
