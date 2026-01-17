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
  authenticatedPage: Page
  testUser: { email: string; password: string }
}

export const test = base.extend<TestFixtures>({
  /**
   * Authenticated page fixture
   * Creates a page with a logged-in user
   */
  authenticatedPage: async ({ page, testUser }, use) => {
    // Navigate to login page
    await page.goto('/login?mode=signin&redirect=/dashboard')
    
    // Fill in credentials
    await page.fill('input[type="email"]', testUser.email)
    await page.fill('input[type="password"]', testUser.password)
    
    // Click sign in button
    await page.click('button:has-text("Sign In")')
    
    // Wait for navigation to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 })
    
    // Verify we're on dashboard
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
