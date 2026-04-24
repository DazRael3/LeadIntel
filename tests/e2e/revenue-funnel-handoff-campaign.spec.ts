import { test, expect } from './fixtures'
import { setE2ECookies } from './utils'
import type { Page } from '@playwright/test'

const E2E_UID = '11111111-1111-4111-8111-111111111111'
const E2E_EMAIL = 'funnel-e2e@example.com'
const CAMPAIGN_NAME = 'E2E Revenue Funnel Campaign'

async function fetchLeads(page: Page, baseURL: string) {
  const response = await page.request.get('/api/leads/discover', {
    headers: { origin: baseURL },
    failOnStatusCode: false,
  })
  expect(response.status()).toBe(200)
  const payload = (await response.json()) as { data?: { leads?: Array<{ id: string; companyDomain: string | null }> } }
  return payload.data?.leads ?? []
}

async function fetchCampaignLeadCount(page: Page, baseURL: string, campaignId: string): Promise<number> {
  const response = await page.request.get(`/api/campaigns/${campaignId}`, {
    headers: { origin: baseURL },
    failOnStatusCode: false,
  })
  expect(response.status()).toBe(200)
  const payload = (await response.json()) as { data?: { leadCount?: number } }
  const leadCount = payload.data?.leadCount
  return typeof leadCount === 'number' ? leadCount : 0
}

test.describe('Revenue funnel: demo handoff to campaigns', () => {
  test('completes demo -> auth -> claim -> campaign -> export gating', async ({ page }) => {
    test.setTimeout(120_000)
    const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

    // Start anonymous, but keep deterministic identity + free plan in E2E shim.
    await setE2ECookies({
      page,
      baseURL,
      authed: false,
      plan: 'free',
      uid: E2E_UID,
      email: E2E_EMAIL,
    })

    // 1) Anonymous demo generation
    await page.goto('/demo')
    await page.locator('#demo-company').fill('acme.com')
    await page.getByRole('button', { name: /run demo lead search/i }).click()
    await expect(page.getByText('Step 2 — Partial results')).toBeVisible()

    // 2) Demo handoff cookie creation
    const cookies = await page.context().cookies(baseURL)
    const handoffCookie = cookies.find((cookie) => cookie.name === 'li_demo_handoff')
    expect(handoffCookie).toBeDefined()
    expect(handoffCookie?.httpOnly).toBe(true)

    // 3) Signup/login
    // 4) Demo claim after auth
    await page.locator('input[placeholder="you@company.com"]').fill(E2E_EMAIL)
    await page.getByRole('button', { name: /continue to signup/i }).click()
    await expect(page).toHaveURL(/\/signup/)
    await page.getByTestId('login-email').fill(E2E_EMAIL)
    await page.getByTestId('login-password').fill('e2e-pass-123')
    const claimResponsePromise = page.waitForResponse((response) => {
      return response.url().includes('/api/demo/claim') && response.request().method() === 'POST'
    })
    await page.getByTestId('login-submit').click()
    const claimResponse = await claimResponsePromise
    expect(claimResponse.status()).toBe(200)

    // 5) Lead appears in lead-results
    await expect(page).toHaveURL(/\/lead-results/)
    const postAuthCookies = await page.context().cookies(baseURL)
    expect(postAuthCookies.some((cookie) => cookie.name === 'li_demo_handoff')).toBe(false)
    const leadsAfterClaim = await fetchLeads(page, baseURL)
    expect(leadsAfterClaim.length).toBeGreaterThan(0)
    expect(leadsAfterClaim.some((lead) => lead.companyDomain === 'acme.com')).toBe(true)

    // 6) Dashboard route loads after claim
    await page.getByRole('link', { name: /open dashboard/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByTestId('dashboard-root')).toBeVisible()

    // 7) Campaign creation
    await page.goto('/campaign')
    await expect(page.getByRole('heading', { name: /campaign builder/i })).toBeVisible()
    const leadCheckbox = page.locator('input[type="checkbox"]').first()
    await expect(leadCheckbox).toBeVisible()
    await leadCheckbox.check()
    await page.locator('#campaign-name').fill(CAMPAIGN_NAME)
    await page.locator('#campaign-objective').fill('Validate end-to-end funnel persistence')
    await page.getByRole('button', { name: /^save campaign$/i }).click()
    await expect(page.getByText('Campaign saved.')).toBeVisible()

    const campaignCard = page
      .locator('div.rounded.border.border-cyan-500\\/10')
      .filter({ hasText: CAMPAIGN_NAME })
      .first()
    await expect(campaignCard).toBeVisible()
    await expect(campaignCard.getByText(/Leads \(1\)/)).toBeVisible()

    // Resolve campaign id for deterministic attach/detach + export checks.
    let campaignId: string | null = null
    await expect
      .poll(
        async () => {
          const campaignsResponse = await page.request.get('/api/campaigns', {
            headers: { origin: baseURL },
            failOnStatusCode: false,
          })
          if (campaignsResponse.status() !== 200) return null
          const campaignsPayload = (await campaignsResponse.json()) as {
            data?: { campaigns?: Array<{ id: string; name: string }> }
          }
          const found = campaignsPayload.data?.campaigns?.find((campaign) => campaign.name === CAMPAIGN_NAME)?.id ?? null
          campaignId = found
          return found
        },
        { timeout: 15000 }
      )
      .toBeTruthy()
    expect(campaignId).toBeTruthy()

    // 8) Attach/detach lead
    await campaignCard.getByRole('button', { name: /remove/i }).first().click()
    await expect
      .poll(
        async () => fetchCampaignLeadCount(page, baseURL, campaignId!),
        { timeout: 15000 }
      )
      .toBe(0)
    const leadCheckboxAfterDetach = page.locator('input[type="checkbox"]').first()
    await expect(leadCheckboxAfterDetach).toBeVisible()
    await leadCheckboxAfterDetach.check()
    await campaignCard.getByRole('button', { name: /attach selected leads/i }).click()
    await expect
      .poll(
        async () => fetchCampaignLeadCount(page, baseURL, campaignId!),
        { timeout: 15000 }
      )
      .toBe(1)

    // 9) Campaign persists after refresh
    await page.reload()
    const campaignCardAfterRefresh = page
      .locator('div.rounded.border.border-cyan-500\\/10')
      .filter({ hasText: CAMPAIGN_NAME })
      .first()
    await expect(campaignCardAfterRefresh).toBeVisible()
    await expect(campaignCardAfterRefresh.getByText(/Leads \(1\)/)).toBeVisible()
    await expect(fetchCampaignLeadCount(page, baseURL, campaignId!)).resolves.toBe(1)

    // 10) Free-plan export blocked
    const freeExportResponse = await page.request.post(`/api/campaigns/${campaignId}/export`, {
      headers: { origin: baseURL },
      data: {},
      failOnStatusCode: false,
    })
    expect(freeExportResponse.status()).toBe(403)

    // 11) Paid-plan export allowed using mocked subscription capability
    await setE2ECookies({
      page,
      baseURL,
      authed: true,
      plan: 'pro',
      uid: E2E_UID,
      email: E2E_EMAIL,
    })
    const paidExportResponse = await page.request.post(`/api/campaigns/${campaignId}/export`, {
      headers: { origin: baseURL },
      data: {},
      failOnStatusCode: false,
    })
    expect(paidExportResponse.status()).toBe(200)
    const paidExportPayload = (await paidExportResponse.json()) as {
      ok?: boolean
      data?: { rows?: number; inlineCsv?: string }
    }
    expect(paidExportPayload.ok).toBe(true)
    expect(typeof paidExportPayload.data?.inlineCsv).toBe('string')
    expect((paidExportPayload.data?.inlineCsv ?? '').length).toBeGreaterThan(0)
  })
})
