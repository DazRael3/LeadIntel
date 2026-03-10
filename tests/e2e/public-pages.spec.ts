import { test, expect } from './fixtures'
import { SUPPORT_EMAIL } from '@/lib/config/contact'

const ROUTES = ['/', '/pricing', '/templates', '/security', '/compare', '/tour', '/use-cases', '/trust', '/version', '/support', '/status']

test.describe('Public pages', () => {
  for (const path of ROUTES) {
    test(`loads ${path}`, async ({ page }) => {
      const res = await page.request.get(path, { failOnStatusCode: false })
      if (res.status() === 404) return
      expect(res.status()).toBeLessThan(500)

      await page.goto(path, { waitUntil: 'domcontentloaded' })

      // Primary CTA exists on marketing routes.
      if (path === '/' || path === '/pricing') {
        await expect(page.getByRole('link', { name: /pricing|get started|sign up/i }).first()).toBeVisible()
      }

      if (path === '/pricing') {
        await expect(page.getByText(/Free plan:\s*3 preview generations total/i)).toBeVisible()
        await expect(page.getByText(/Usage is shared across pitches and reports/i)).toBeVisible()
      }

      if (path === '/use-cases') {
        await expect(page.getByText(/Best-fit motions/i)).toBeVisible()
        await expect(page.getByText(/Workflow types/i)).toBeVisible()
        await expect(page.getByText(/Team rollout/i)).toBeVisible()
        // Use-cases hub should not show internal route strings as CTA labels.
        await expect(page.locator('body')).not.toContainText('/settings/')
        await expect(page.locator('body')).not.toContainText('/dashboard')
      }

      // Footer should link to the human-readable version page (not raw JSON).
      const versionLink = page.getByRole('link', { name: /^Version$/ })
      if ((await versionLink.count()) > 0) {
        await expect(versionLink.first()).toHaveAttribute('href', '/version')
      }

      // Footer contact email should be visible on public layout pages.
      await expect(page.getByRole('link', { name: SUPPORT_EMAIL }).first()).toBeVisible()
    })
  }
})

