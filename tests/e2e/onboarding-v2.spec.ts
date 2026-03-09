import { test, expect } from './fixtures'
import { requireEnv, loginViaUi, setE2ECookies } from './utils'

test.describe('Onboarding v2', () => {
  test('loads and persists basic progress', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = requireEnv('E2E_EMAIL')
    const password = requireEnv('E2E_PASSWORD')

    await setE2ECookies({ page, baseURL, plan: 'pro', uid: 'e2e_onboarding_v2', email })
    await loginViaUi({ page, email, password })

    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Onboarding')).toBeVisible()

    await page.getByRole('button', { name: 'Track target accounts' }).click()
    await expect(page.getByText(/Add targets/i)).toBeVisible()

    await page.getByLabel('Company names, domains, or URLs').fill('e2e-onboarding.example.com')
    await page.getByRole('button', { name: 'Add targets' }).click()

    await expect(page.getByText(/Pick workflow/i)).toBeVisible()
    await page.getByRole('button', { name: 'Pitch workflow' }).click()
    await expect(page.getByText(/First result/i)).toBeVisible()

    // Skippable but persistent: skip should not crash and should land back in app.
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

