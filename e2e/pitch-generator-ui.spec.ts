/**
 * Pitch Generator UI E2E Test
 *
 * Ensures the dashboard/home PitchGenerator renders the actual pitch text returned
 * by the standardized API envelope ({ ok: true, data: { pitch } }).
 */

import { test, expect } from './fixtures'

test.describe('Pitch Generator UI', () => {
  test('should render generated pitch text (not fallback message)', async ({ authenticatedPage }) => {
    // Use the dedicated pitch page to avoid dashboard UI churn.
    await authenticatedPage.goto('/pitch')
    await expect(authenticatedPage.locator('text=Generate Pitch')).toBeVisible()

    // Fill input
    const input = authenticatedPage.getByTestId('pitch-input')
    await expect(input).toBeVisible()
    // React-controlled input + Next dev hydration can make Playwright's .fill action flaky here.
    // Set the value in the DOM and dispatch input/change events instead.
    await authenticatedPage.evaluate(() => {
      const el = document.querySelector('[data-testid="pitch-input"]') as HTMLInputElement | null
      if (!el) throw new Error('Pitch input not found')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter?.call(el, 'Dell.com')
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })

    // Click Generate
    const generateButton = authenticatedPage.getByTestId('pitch-generate')
    await expect(generateButton).toBeVisible()

    await authenticatedPage.evaluate(() => {
      const btn = document.querySelector('[data-testid="pitch-generate"]') as HTMLButtonElement | null
      if (!btn) throw new Error('Generate button not found')
      btn.click()
    })

    // Ensure the Generated Pitch card renders actual text (in E2E it is deterministic).
    await expect(authenticatedPage.locator('text=Generated Pitch')).toBeVisible({ timeout: 30_000 })

    // Fallback must not be shown.
    await expect(authenticatedPage.locator('text=Pitch generation completed, but no pitch text was returned.')).toHaveCount(0)

    // Expect some non-empty pitch content to be visible.
    // In E2E mode, the backend returns a deterministic pitch containing these phrases.
    await expect(authenticatedPage.locator('text=/competitive intelligence report/i').first()).toBeVisible()
    await expect(authenticatedPage.locator('text=/View it here:/').first()).toBeVisible()
  })
})

