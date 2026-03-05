import { test, expect } from './fixtures'
import { requireEnv, loginViaUi, setE2ECookies } from './utils'

test.describe('Activation flow', () => {
  test('completes ICP + 10 accounts + first pitch + cadence', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = requireEnv('E2E_EMAIL')
    const password = requireEnv('E2E_PASSWORD')

    await page.addInitScript(() => {
      try {
        localStorage.clear()
      } catch {
        // ignore
      }
    })

    await setE2ECookies({ page, baseURL, plan: 'pro', uid: 'e2e_activation', email })
    await loginViaUi({ page, email, password })
    await expect(page).toHaveURL(/\/dashboard/)

    const domains = Array.from({ length: 10 }).map((_, i) => `e2e-${String(i + 1).padStart(2, '0')}.example.com`)
    const seed = await page.request.post('/api/e2e/seed-activation', {
      data: { domains },
      headers: { 'Content-Type': 'application/json' },
      failOnStatusCode: false,
    })
    expect(seed.status()).toBe(200)

    await expect
      .poll(async () => {
        const activationRes = await page.request.get('/api/activation', { failOnStatusCode: false })
        const activationJson = (await activationRes.json()) as any
        return {
          status: activationRes.status(),
          ok: activationJson?.ok === true,
          completed: activationJson?.data?.activation?.completed === true,
          completedCount: activationJson?.data?.activation?.completedCount ?? 0,
        }
      }, { timeout: 15000 })
      .toMatchObject({ status: 200, ok: true, completed: true, completedCount: 4 })
  })
})

