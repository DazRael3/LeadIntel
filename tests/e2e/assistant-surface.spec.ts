import { test, expect } from './fixtures'
import { loginViaUi, setE2ECookies } from './utils'

test.describe('Assistant surfaces', () => {
  test('assistant settings page renders for team user', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = process.env.E2E_TEAM_EMAIL
    const password = process.env.E2E_TEAM_PASSWORD
    test.skip(!email || !password, 'Requires E2E_TEAM_EMAIL/E2E_TEAM_PASSWORD')

    await setE2ECookies({ page, baseURL, plan: 'team', uid: 'e2e_team_owner', email: email! })
    await loginViaUi({ page, email: email!, password: password! })

    await page.goto('/settings/assistant')
    await expect(page.getByTestId('assistant-settings-page')).toBeVisible({ timeout: 15000 })
  })
})

