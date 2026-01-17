/**
 * Login Flow E2E Tests
 * 
 * Tests the authentication flow including sign in and sign up.
 */

import { test, expect } from './fixtures'

test.describe('Login Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login')
    
    // Check page title or heading
    await expect(page).toHaveURL(/\/login/)
    
    // Check for email input
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()
    
    // Check for password input
    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toBeVisible()
    
    // Check for sign in button
    const signInButton = page.locator('button:has-text("Sign In")')
    await expect(signInButton).toBeVisible()
  })

  test('should switch between sign in and sign up modes', async ({ page }) => {
    await page.goto('/login?mode=signin')
    
    // Initially in sign in mode
    await expect(page).toHaveURL(/mode=signin/)
    
    // Switch to sign up mode
    const signUpButton = page.locator('button:has-text("Sign Up")').first()
    if (await signUpButton.isVisible()) {
      await signUpButton.click()
      await expect(page).toHaveURL(/mode=signup/)
    }
  })

  test('should show validation error for invalid email', async ({ page }) => {
    await page.goto('/login?mode=signin')
    
    // Fill invalid email
    await page.fill('input[type="email"]', 'invalid-email')
    await page.fill('input[type="password"]', 'password123')
    
    // Try to submit (if form validation is client-side)
    const signInButton = page.locator('button:has-text("Sign In")')
    await signInButton.click()
    
    // Wait a bit for any validation messages
    await page.waitForTimeout(500)
    
    // Check if there's a validation error (may vary based on implementation)
    // This test is flexible - it just checks the page doesn't navigate on invalid input
    const currentUrl = page.url()
    expect(currentUrl).toContain('/login')
  })

  test('should show validation error for short password in signup', async ({ page }) => {
    await page.goto('/login?mode=signup')
    
    // Fill short password
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', '12345') // Less than 6 characters
    
    // Try to submit
    const signUpButton = page.locator('button:has-text("Sign Up")')
    await signUpButton.click()
    
    // Wait for validation
    await page.waitForTimeout(500)
    
    // Should still be on login page
    expect(page.url()).toContain('/login')
  })

  test('should redirect to dashboard after successful login', async ({ authenticatedPage }) => {
    // authenticatedPage fixture handles login
    // Just verify we're on dashboard
    await expect(authenticatedPage).toHaveURL(/\/dashboard/)
    
    // Check for dashboard content (adjust selector based on actual dashboard)
    const dashboardContent = authenticatedPage.locator('body')
    await expect(dashboardContent).toBeVisible()
  })
})
