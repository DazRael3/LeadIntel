import { test, expect } from './fixtures'
import { setE2ECookies } from './utils'

test.describe('Revenue intelligence', () => {
  test('revenue intelligence settings page renders for team user', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = process.env.E2E_EMAIL || 'e2e@example.com'

    await setE2ECookies({ page, baseURL, authed: true, plan: 'team', uid: 'e2e_revenue_team', email })
    await page.goto('/settings/revenue-intelligence')
    await expect(page.getByTestId('revenue-intelligence-settings-page')).toBeVisible({ timeout: 15000 })
  })

  test('verification dashboard renders for team user', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = process.env.E2E_EMAIL || 'e2e@example.com'

    await setE2ECookies({ page, baseURL, authed: true, plan: 'team', uid: 'e2e_revenue_team', email })
    await page.goto('/dashboard/verification')
    await expect(page.getByTestId('verification-dashboard-page')).toBeVisible({ timeout: 15000 })
  })
})

