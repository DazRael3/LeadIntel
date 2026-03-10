import { test, expect } from './fixtures'
import { setE2ECookies } from './utils'

test.describe('Auth', () => {
  test('logs in and loads dashboard', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = process.env.E2E_EMAIL || 'e2e@example.com'

    // Ensure E2E shim sees a stable user + plan.
    await setE2ECookies({ page, baseURL, authed: true, plan: 'pro', uid: 'e2e_login', email })

    await page.goto('/dashboard')
    await expect(page.getByTestId('dashboard-root')).toBeVisible()
  })
})

