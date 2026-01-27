import { test, expect } from './fixtures'

test('pro user can customize market watchlist and ticker reflects it', async ({ authenticatedPage: page }) => {
  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001'

  const clickByTestId = async (id: string) => {
    const el = page.getByTestId(id)
    await expect(el).toBeVisible()
    await el.evaluate((n) => (n as HTMLElement).click())
  }

  const setInputByTestId = async (id: string, value: string) => {
    const el = page.getByTestId(id)
    await expect(el).toBeVisible()
    await el.evaluate(
      (n, v) => {
        const input = n as HTMLInputElement
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        if (setter) setter.call(input, v)
        else input.value = v
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      },
      value
    )
  }

  const setSelectByTestId = async (id: string, value: string) => {
    const el = page.getByTestId(id)
    await expect(el).toBeVisible()
    await el.evaluate(
      (n, v) => {
        const select = n as HTMLSelectElement
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
        if (setter) setter.call(select, v)
        else select.value = v
        select.dispatchEvent(new Event('change', { bubbles: true }))
      },
      value
    )
  }

  // Upgrade this E2E user to Pro via cookie (used by our E2E Supabase shim).
  await page.context().addCookies([{ name: 'li_e2e_plan', value: 'pro', url: baseURL }])
  await page.goto('/dashboard')

  // Open editor from Market Pulse side panel.
  await clickByTestId('market-watchlist-edit')
  await expect(page.getByTestId('market-watchlist-modal')).toBeVisible()

  // Clear defaults and set a tiny custom list.
  await clickByTestId('market-watchlist-clear')

  await setInputByTestId('market-watchlist-symbol', 'PLTR')
  await setSelectByTestId('market-watchlist-type', 'stock')
  await clickByTestId('market-watchlist-add')

  await setInputByTestId('market-watchlist-symbol', 'DOGE')
  await setSelectByTestId('market-watchlist-type', 'crypto')
  await clickByTestId('market-watchlist-add')

  await clickByTestId('market-watchlist-save')
  await expect(page.getByTestId('market-watchlist-modal')).toBeHidden()

  // Side panel should now reflect the custom list size.
  await expect(page.getByTestId('market-watchlist-count')).toContainText('2 symbols')

  // Ticker should now contain our custom symbols.
  await expect(page.getByTestId('market-ticker')).toContainText('PLTR')
  await expect(page.getByTestId('market-ticker')).toContainText('DOGE')

  // Refresh and ensure it persists.
  await page.reload()
  await expect(page.getByTestId('market-ticker')).toContainText('PLTR')
  await expect(page.getByTestId('market-ticker')).toContainText('DOGE')
})

