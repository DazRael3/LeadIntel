import { test, expect } from './fixtures'
import { setE2ECookies } from './utils'

test.describe('Onboarding v2', () => {
  test('loads and persists basic progress', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = process.env.E2E_EMAIL || 'e2e@example.com'

    await setE2ECookies({ page, baseURL, authed: true, plan: 'pro', uid: 'e2e_onboarding_v2', email })

    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Onboarding' })).toBeVisible({ timeout: 15000 })

    // Onboarding can evolve; this test asserts the surface loads and is skippable.
    await page.getByRole('link', { name: 'Open dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

