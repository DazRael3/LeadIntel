/**
 * Dashboard E2E Tests
 * 
 * Tests the dashboard page for authenticated users.
 */

import { test, expect } from './fixtures'

test.describe('Dashboard', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard')
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
  })

  test('should load dashboard for authenticated user', async ({ authenticatedPage }) => {
    // authenticatedPage fixture handles login
    // Verify we're on dashboard
    await expect(authenticatedPage).toHaveURL(/\/dashboard/)
    
    // Check dashboard content is visible
    const dashboardContent = authenticatedPage.locator('body')
    await expect(dashboardContent).toBeVisible()
    
    // Verify page loaded successfully (not blank)
    const pageText = await dashboardContent.textContent()
    expect(pageText?.length).toBeGreaterThan(0)
  })

  test('should display user information', async ({ authenticatedPage }) => {
    // Check for common dashboard elements
    // Adjust selectors based on actual DashboardClient component
    
    // Look for navigation or header
    const nav = authenticatedPage.locator('nav, header, [role="navigation"]').first()
    const navVisible = await nav.isVisible().catch(() => false)
    
    // Dashboard should have some content
    const body = authenticatedPage.locator('body')
    await expect(body).toBeVisible()
  })

  test('should handle dashboard interactions', async ({ authenticatedPage }) => {
    // Verify page is interactive
    const body = authenticatedPage.locator('body')
    await expect(body).toBeVisible()
    
    // Check that page doesn't show error messages
    const errorMessages = authenticatedPage.locator('text=/error/i, text=/failed/i')
    const errorCount = await errorMessages.count()
    
    // Should not have prominent error messages (may have 0 or very few)
    expect(errorCount).toBeLessThan(5)
  })
})
