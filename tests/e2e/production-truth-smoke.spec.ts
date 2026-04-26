import { test, expect } from './fixtures'
import { setE2ECookies } from './utils'
import type { Page } from '@playwright/test'

function shouldIgnoreResponse(url: string): boolean {
  return url.startsWith('data:') || url.startsWith('blob:')
}

async function gotoStable(page: Page, route: string): Promise<void> {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  expect(response, `missing response for ${route}`).not.toBeNull()
  expect(response?.status(), `initial response failed for ${route}`).toBeLessThan(500)
  await expect(page.locator('body')).toBeVisible()
}

test.describe('Production truth smoke routes', () => {
  const publicRoutes = ['/', '/demo', '/pricing', '/signup', '/login', '/lead-results'] as const

  for (const route of publicRoutes) {
    test(`public route smoke: ${route}`, async ({ page }) => {
      const pageErrors: string[] = []
      const badResponses: string[] = []

      page.on('pageerror', (error) => pageErrors.push(error.message))
      page.on('response', (response) => {
        if (shouldIgnoreResponse(response.url())) return
        if (response.status() >= 500) badResponses.push(`${response.status()} ${response.url()}`)
      })

      await gotoStable(page, route)
      expect(pageErrors, `page errors on ${route}`).toEqual([])
      expect(badResponses, `5xx responses on ${route}`).toEqual([])
    })
  }

  test('authenticated route smoke: /dashboard, /dashboard/actions, /campaign, /settings/billing', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
    const email = process.env.E2E_EMAIL || 'prod-smoke@example.com'
    await setE2ECookies({
      page,
      baseURL,
      authed: true,
      plan: 'pro',
      uid: 'e2e_truth_smoke',
      email,
    })

    await gotoStable(page, '/dashboard')
    await expect(page.getByTestId('dashboard-root')).toBeVisible()

    await gotoStable(page, '/dashboard/actions')
    await expect(page.getByTestId('actions-page')).toBeVisible()

    await gotoStable(page, '/campaign')
    await expect(page.getByRole('heading', { name: /campaign builder/i })).toBeVisible()

    await gotoStable(page, '/settings/billing')
    await expect(page.getByRole('heading', { name: /^billing$/i })).toBeVisible()
  })
})

test.describe('Production truth core flows', () => {
  test('landing input handoff to demo query auto-runs', async ({ page }) => {
    await gotoStable(page, '/')
    await page.getByLabel(/company or domain/i).fill('acme.com')
    await page.getByRole('button', { name: /generate my leads/i }).click()
    await expect(page).toHaveURL(/\/demo\?company=acme\.com/)
    await expect(page.locator('#demo-company')).toHaveValue('acme.com')
    await expect(page.getByText('Best lead right now')).toBeVisible({ timeout: 20_000 })
  })

  test('anonymous demo allows initial run and rate-limits after max usage', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
    const headers = { origin: baseURL, 'Content-Type': 'application/json' }
    const data = { companyOrUrl: 'acme.com', sessionId: 'truth-smoke-session' }

    const first = await page.request.post('/api/sample-digest', { headers, data, failOnStatusCode: false })
    expect(first.status()).toBe(200)

    const second = await page.request.post('/api/sample-digest', { headers, data, failOnStatusCode: false })
    expect(second.status()).toBe(200)

    const third = await page.request.post('/api/sample-digest', { headers, data, failOnStatusCode: false })
    expect(third.status()).toBe(429)
    const payload = (await third.json()) as { ok?: boolean; error?: { code?: string } }
    expect(payload.ok).toBe(false)
    expect(payload.error?.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  test('signup path creates starter/free user plan in E2E mode', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
    const email = `truth-signup-${Date.now()}@example.com`

    await setE2ECookies({
      page,
      baseURL,
      authed: false,
      uid: 'e2e_signup_truth',
      email,
    })

    await gotoStable(page, '/signup?redirect=%2Fdashboard')
    await page.getByTestId('login-email').fill(email)
    await page.getByTestId('login-password').fill('e2e-pass-123')
    await page.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/dashboard/)

    const planRes = await page.request.get('/api/plan', {
      headers: { origin: baseURL },
      failOnStatusCode: false,
    })
    expect(planRes.status()).toBe(200)
    const planPayload = (await planRes.json()) as { data?: { tier?: string; plan?: string } }
    expect(planPayload.data?.tier).toBe('starter')
    expect(planPayload.data?.plan).toBe('free')
  })

  test('free users cannot export while paid users can export', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
    const email = process.env.E2E_EMAIL || 'truth-export@example.com'
    const common = { page, baseURL, uid: 'e2e_export_truth', email }

    await setE2ECookies({ ...common, authed: true, plan: 'free' })
    const freeRes = await page.request.get('/api/history/export', {
      headers: { origin: baseURL },
      failOnStatusCode: false,
    })
    expect(freeRes.status()).toBe(403)

    await setE2ECookies({ ...common, authed: true, plan: 'pro' })
    const paidRes = await page.request.get('/api/history/export', {
      headers: { origin: baseURL },
      failOnStatusCode: false,
    })
    expect(paidRes.status()).toBe(200)
    expect(paidRes.headers()['content-type'] || '').toContain('text/csv')
  })

  test('pricing checkout starts correctly in mock mode', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
    const email = process.env.E2E_EMAIL || 'truth-pricing@example.com'
    await setE2ECookies({
      page,
      baseURL,
      authed: true,
      plan: 'free',
      uid: 'e2e_pricing_truth',
      email,
    })

    let requestBody: { planId?: string; billingCycle?: string } | null = null
    await page.route('**/api/checkout', async (route) => {
      const postData = route.request().postDataJSON()
      requestBody = typeof postData === 'object' && postData !== null ? (postData as { planId?: string; billingCycle?: string }) : null
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { url: '/dashboard?checkout=mock' } }),
      })
    })

    await gotoStable(page, '/pricing')
    await page.getByRole('button', { name: /upgrade to pro/i }).first().click()
    await expect(page).toHaveURL(/\/dashboard\?checkout=mock/)
    const capturedBody = requestBody as { planId?: string; billingCycle?: string } | null
    expect(capturedBody).not.toBeNull()
    expect(capturedBody?.planId).toBe('pro')
  })
})
