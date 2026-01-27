import { test, expect } from './fixtures'

test('pro user can star a market symbol and it persists after reload', async ({ authenticatedPage: page }) => {
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001'

  // Upgrade this E2E user to Pro via cookie (used by our E2E Supabase shim).
  await page.context().addCookies([{ name: 'li_e2e_plan', value: 'pro', url: baseURL }])
  await page.goto('/dashboard')

  // Star AAPL from the sidebar
  const star = page.getByTestId('market-star-AAPL')
  await expect(star).toBeVisible()
  await expect(star).toBeEnabled({ timeout: 15000 })
  await star.evaluate((n) => (n as HTMLButtonElement).click())

  // Ticker is present (layout-level)
  await expect(page.getByTestId('market-ticker')).toBeVisible()

  // Refresh and ensure it persists.
  await page.reload()
  await expect(page.getByTestId('market-star-AAPL').locator('svg')).toHaveClass(/fill-yellow-400/)
})

