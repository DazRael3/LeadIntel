/**
 * Pitch Generator UI E2E Test
 *
 * Ensures the dashboard/home PitchGenerator renders the actual pitch text returned
 * by the standardized API envelope ({ ok: true, data: { pitch } }).
 */

import { test, expect } from './fixtures'

test.describe('Pitch Generator UI', () => {
  test('should render generated pitch text (not fallback message)', async ({ authenticatedPage }) => {
    // The PitchGenerator UI lives on the home page ("/").
    await authenticatedPage.goto('/')

    // Fill input
    const input = authenticatedPage.locator('input[placeholder*="lego.com"]').first()
    await expect(input).toBeVisible()
    await input.fill('Dell.com')

    // Click Generate
    const generateButton = authenticatedPage.locator('button:has-text("Generate")').first()
    await expect(generateButton).toBeVisible()

    const respPromise = authenticatedPage.waitForResponse((r) => r.url().includes('/api/generate-pitch') && r.status() === 200)
    await generateButton.click()
    await respPromise

    // Ensure the Generated Pitch card renders actual text (in E2E it is deterministic).
    await expect(authenticatedPage.locator('text=Generated Pitch')).toBeVisible()

    // Fallback must not be shown.
    await expect(authenticatedPage.locator('text=Pitch generation completed, but no pitch text was returned.')).toHaveCount(0)

    // Expect some non-empty pitch content to be visible.
    // In E2E mode, the backend returns a deterministic pitch containing these phrases.
    await expect(authenticatedPage.locator('text=/competitive intelligence report/i').first()).toBeVisible()
    await expect(authenticatedPage.locator('text=/View it here:/').first()).toBeVisible()
  })
})

