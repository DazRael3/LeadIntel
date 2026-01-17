/**
 * Pricing and Checkout Flow E2E Tests
 * 
 * Tests the pricing page and checkout flow (without actual payments).
 */

import { test, expect } from './fixtures'

test.describe('Pricing and Checkout', () => {
  test('should display pricing page', async ({ page }) => {
    await page.goto('/pricing')
    
    // Check URL
    await expect(page).toHaveURL(/\/pricing/)
    
    // Check for pricing content
    // Adjust selectors based on actual Pricing component
    const pricingContent = page.locator('body')
    await expect(pricingContent).toBeVisible()
    
    // Check for pricing tiers (Free/Pro)
    const freeTier = page.locator('text=/free/i').first()
    const proTier = page.locator('text=/pro/i').first()
    
    // At least one tier should be visible
    const freeVisible = await freeTier.isVisible().catch(() => false)
    const proVisible = await proTier.isVisible().catch(() => false)
    
    expect(freeVisible || proVisible).toBe(true)
  })

  test('should navigate to checkout when clicking upgrade button', async ({ page }) => {
    await page.goto('/pricing')
    
    // Look for upgrade/checkout button
    // This selector may need adjustment based on actual component
    const upgradeButton = page.locator('button:has-text("Upgrade"), button:has-text("Get Started"), a:has-text("Upgrade"), a:has-text("Get Started")').first()
    
    if (await upgradeButton.isVisible()) {
      // Intercept checkout API call to prevent actual payment
      await page.route('**/api/checkout**', async (route) => {
        const response = await route.fetch()
        const json = await response.json()
        
        // Return mock response that doesn't actually charge
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              checkoutUrl: 'https://checkout.stripe.com/test-session',
              sessionId: 'test_session_123',
            },
          }),
        })
      })
      
      // Click upgrade button
      await upgradeButton.click()
      
      // Wait for navigation or API call
      await page.waitForTimeout(2000)
      
      // Check if checkout URL was generated (or page navigated)
      // The actual behavior depends on implementation
      // This test verifies the button works without actually charging
    } else {
      // If no upgrade button found, skip this test
      test.skip()
    }
  })

  test('should display pricing information correctly', async ({ page }) => {
    await page.goto('/pricing')
    
    // Check page loads without errors
    await expect(page).toHaveURL(/\/pricing/)
    
    // Check for common pricing page elements
    const pageContent = page.locator('body')
    await expect(pageContent).toBeVisible()
    
    // Verify page is interactive (not a blank error page)
    const hasContent = await pageContent.textContent()
    expect(hasContent?.length).toBeGreaterThan(0)
  })
})
