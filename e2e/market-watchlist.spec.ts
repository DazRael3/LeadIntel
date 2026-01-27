import { test, expect } from './fixtures'

test('pro user can customize market watchlist and ticker reflects it', async ({ authenticatedPage: page }) => {
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001'

  // Upgrade this E2E user to Pro via cookie (used by our E2E Supabase shim).
  await page.context().addCookies([{ name: 'li_e2e_plan', value: 'pro', url: baseURL }])
  await page.reload()

  // Open editor from Market Pulse side panel.
  await page.getByRole('button', { name: 'Edit Watchlist' }).click()
  await expect(page.getByTestId('market-watchlist-modal')).toBeVisible()

  // Clear defaults and set a tiny custom list.
  await page.getByRole('button', { name: 'Clear' }).click()

  await page.getByTestId('market-watchlist-symbol').fill('PLTR')
  await page.getByTestId('market-watchlist-type').selectOption('stock')
  await page.getByTestId('market-watchlist-add').click()

  await page.getByTestId('market-watchlist-symbol').fill('DOGE')
  await page.getByTestId('market-watchlist-type').selectOption('crypto')
  await page.getByTestId('market-watchlist-add').click()

  await page.getByTestId('market-watchlist-save').click()
  await expect(page.getByTestId('market-watchlist-modal')).toBeHidden()

  // Ticker should now contain our custom symbols.
  await expect(page.getByTestId('market-ticker')).toContainText('PLTR')
  await expect(page.getByTestId('market-ticker')).toContainText('DOGE')

  // Refresh and ensure it persists.
  await page.reload()
  await expect(page.getByTestId('market-ticker')).toContainText('PLTR')
  await expect(page.getByTestId('market-ticker')).toContainText('DOGE')
})

