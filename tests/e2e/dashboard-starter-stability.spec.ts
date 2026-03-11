import { test, expect } from './fixtures'
import { setE2ECookies } from './utils'

test.describe('Dashboard (Starter) stability', () => {
  test('does not fire team/pro-only requests and avoids overflow', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = process.env.E2E_EMAIL || 'e2e@example.com'

    await setE2ECookies({ page, baseURL, authed: true, plan: 'free', uid: 'e2e_starter', email })

    const blocked: string[] = []
    const banned = [
      '/api/team/planning',
      '/api/team/benchmarks',
      '/api/team/playbook-benchmarks',
      '/api/team/category-intelligence',
      '/api/workspace/actions/queue',
      '/api/partners/',
      '/api/workspaces/directory',
    ]

    page.on('request', (req) => {
      const url = req.url()
      try {
        const u = new URL(url)
        const path = u.pathname
        if (banned.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p))) {
          blocked.push(path)
        }
      } catch {
        // ignore
      }
    })

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('dashboard-root')).toBeVisible()

    // Starter rail should be uncluttered.
    await expect(page.getByRole('tab', { name: /Command Center/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Lead Library/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Settings/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Website Visitors/i })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: /Live Intent/i })).toHaveCount(0)

    // "Companies" should not be a broken placeholder.
    const metrics = page.getByTestId('dashboard-metrics')
    await expect(metrics.getByText('Tracked accounts', { exact: true })).toBeVisible()
    await expect(metrics.getByText('Events', { exact: true })).toBeVisible()

    // No horizontal page-wide overflow.
    const hasOverflow = await page.evaluate(() => {
      const el = document.documentElement
      return el.scrollWidth > el.clientWidth + 2
    })
    expect(hasOverflow).toBe(false)

    // Give any late effects a moment; Starter should not be spamming forbidden/team endpoints.
    await page.waitForTimeout(800)
    expect(blocked).toEqual([])
  })
})

