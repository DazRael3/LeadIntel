import { test, expect } from './fixtures'
import { setE2ECookies } from './utils'

test.describe('Sources settings', () => {
  test('sources settings page renders for team user', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = process.env.E2E_EMAIL || 'e2e@example.com'

    await setE2ECookies({ page, baseURL, authed: true, plan: 'team', uid: 'e2e_sources_team', email })
    await page.goto('/settings/sources')
    await expect(page.getByTestId('sources-settings-page')).toBeVisible({ timeout: 15000 })
  })
})

