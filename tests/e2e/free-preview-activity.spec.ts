import { test, expect } from './fixtures'
import { setE2ECookies } from './utils'

test.describe('Free preview usage coherence', () => {
  test('pitch preview usage shows on reports page with recent activity (no fake reports)', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = process.env.E2E_EMAIL || 'e2e@example.com'

    await setE2ECookies({ page, baseURL, authed: true, plan: 'free', uid: 'e2e_free_preview', email })
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)

    const seed = await page.request.post('/api/e2e/seed-free-preview', {
      data: { companyDomain: 'e2e-preview.example.com', companyName: 'E2E Preview Co' },
      headers: { 'Content-Type': 'application/json' },
      failOnStatusCode: false,
    })
    expect(seed.status()).toBe(200)

    await page.goto('/competitive-report')

    await expect(page.getByText('Recent premium activity')).toBeVisible()
    await expect(page.getByText(/Pitch and report preview limits are tracked separately\./i)).toBeVisible()
  })
})

