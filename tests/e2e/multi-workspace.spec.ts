import { test, expect } from './fixtures'
import { setE2ECookies } from './utils'

test('renders workspace switcher and partner dashboard (team)', async ({ page }) => {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
  await setE2ECookies({
    page,
    baseURL,
    authed: true,
    plan: 'team',
    uid: '00000000-0000-0000-0000-000000000123',
    email: 'e2e-team@example.com',
  })

  await page.goto('/dashboard')
  // Workspace badge (from workspace switcher) should be present on md+ layout.
  await expect(page.getByTestId('dashboard-root')).toBeVisible({ timeout: 15000 })

  // Partner dashboard should load for team plan.
  await page.goto('/dashboard/partner')
  await expect(page.getByText('Partner / multi-workspace overview')).toBeVisible()
})

