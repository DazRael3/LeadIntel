import { test, expect } from './fixtures'
import { setE2ECookies } from './utils'

test.describe('Growth + experiments', () => {
  test('experiments settings page renders for team user', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = process.env.E2E_EMAIL || 'e2e@example.com'

    await setE2ECookies({ page, baseURL, authed: true, plan: 'team', uid: 'e2e_growth_team', email })
    await page.goto('/settings/experiments')
    await expect(page.getByTestId('experiments-settings-page')).toBeVisible({ timeout: 15000 })
  })

  test('growth dashboard renders for team user', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = process.env.E2E_EMAIL || 'e2e@example.com'

    await setE2ECookies({ page, baseURL, authed: true, plan: 'team', uid: 'e2e_growth_team', email })
    await page.goto('/dashboard/growth')
    await expect(page.getByTestId('growth-dashboard-page')).toBeVisible({ timeout: 15000 })
  })
})

