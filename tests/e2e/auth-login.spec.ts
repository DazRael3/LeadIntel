import { test, expect } from './fixtures'
import { requireEnv, loginViaUi, setE2ECookies } from './utils'

test.describe('Auth', () => {
  test('logs in and loads dashboard', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = requireEnv('E2E_EMAIL')
    const password = requireEnv('E2E_PASSWORD')

    // Ensure E2E shim sees a stable user + plan.
    await setE2ECookies({ page, baseURL, plan: 'pro', uid: 'e2e_login', email })

    await loginViaUi({ page, email, password })
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByTestId('dashboard-root')).toBeVisible()
  })
})

