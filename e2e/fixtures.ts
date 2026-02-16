/**
 * Playwright Test Fixtures
 * 
 * Shared test utilities and helpers for E2E tests.
 */

import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Extended test context with custom fixtures
 */
type TestFixtures = {
  page: Page
  authenticatedPage: Page
  testUser: { email: string; password: string }
}

export const test = base.extend<TestFixtures>({
  /**
   * Reset in-memory rate limits between tests (E2E server uses memory limiter).
   * This prevents cross-test interference where one test exhausts a route's limit
   * and causes unrelated tests to see 429s.
   */
  page: async ({ page }, use) => {
    // Best-effort: if server isn't up yet, ignore.
    await page.request.get('/api/__e2e/reset-ratelimits', { failOnStatusCode: false }).catch(() => undefined)
    await use(page)
  },
  /**
   * Authenticated page fixture
   * Creates a page with a logged-in user
   */
  authenticatedPage: async ({ page, testUser }, use, testInfo) => {
    // Fast + deterministic E2E auth:
    // Our E2E Supabase shim treats `li_e2e_auth=1` as authenticated.
    // This avoids flaky UI login flows and eliminates timeouts when the UI is under load.
    // Ensure cookie is set for the current baseURL origin (Playwright will resolve relative navigations).
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001'
    // Use a per-test user id so in-memory rate limits don't leak across parallel tests.
    const uid = `e2e_${testInfo.workerIndex}_${testInfo.testId}`
    await page.context().addCookies([
      { name: 'li_e2e_auth', value: '1', url: baseURL },
      { name: 'li_e2e_uid', value: uid, url: baseURL },
    ])

    // Navigate directly to dashboard.
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
    
    // Use the authenticated page
    await use(page)
  },

  /**
   * Test user credentials
   * Uses TEST_EMAIL/TEST_PASSWORD or E2E_TEST_USER_EMAIL/E2E_TEST_USER_PASSWORD env vars
   * Falls back to defaults if not provided
   */
  testUser: async ({}, use) => {
    const testUser = {
      email: process.env.TEST_EMAIL || process.env.E2E_TEST_USER_EMAIL || 'e2e-test@example.com',
      password: process.env.TEST_PASSWORD || process.env.E2E_TEST_USER_PASSWORD || 'test-password-123',
    }
    
    await use(testUser)
  },
})

export { expect }
