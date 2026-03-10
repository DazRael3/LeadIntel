import { test, expect } from './fixtures'
import { loginViaUi, setE2ECookies } from './utils'

test.describe('Mobile + executive + command surfaces', () => {
  test('mobile dashboard shortlist + reporting surfaces render', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = process.env.E2E_TEAM_EMAIL
    const password = process.env.E2E_TEAM_PASSWORD

    test.skip(!email || !password, 'Requires E2E_TEAM_EMAIL/E2E_TEAM_PASSWORD')

    await page.setViewportSize({ width: 390, height: 844 })
    await setE2ECookies({ page, baseURL, plan: 'team', uid: 'e2e_team_owner', email: email! })
    await loginViaUi({ page, email: email!, password: password! })

    await page.goto('/dashboard')
    await expect(page.getByTestId('dashboard-root')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('mobile-shortlist')).toBeVisible({ timeout: 15000 })

    await page.goto('/dashboard/approvals')
    await expect(page.getByTestId('approvals-dashboard-page')).toBeVisible({ timeout: 15000 })

    await page.goto('/dashboard/command-center')
    await expect(page.getByTestId('command-center-page')).toBeVisible({ timeout: 15000 })

    await page.goto('/dashboard/executive')
    await expect(page.getByTestId('executive-dashboard-page')).toBeVisible({ timeout: 15000 })

    await page.goto('/settings/reporting')
    await expect(page.getByTestId('reporting-settings-page')).toBeVisible({ timeout: 15000 })
  })
})

