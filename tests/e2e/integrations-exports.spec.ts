import { test, expect } from './fixtures'
import { loginViaUi, requireEnv, setE2ECookies } from './utils'

test.describe('Integrations + Exports', () => {
  test('webhook test delivery and export job ready', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = requireEnv('E2E_TEAM_EMAIL')
    const password = requireEnv('E2E_TEAM_PASSWORD')
    const webhookUrl = requireEnv('E2E_WEBHOOK_TARGET_URL')

    await setE2ECookies({ page, baseURL, plan: 'team', uid: 'e2e_integrations_owner', email })
    await loginViaUi({ page, email, password })
    await expect(page).toHaveURL(/\/dashboard/)

    await page.goto('/settings/integrations')
    await expect(page.getByTestId('integrations-page')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('webhooks-create-url').fill(webhookUrl)
    await page.getByTestId('webhooks-create-submit').click()
    await expect(page.getByTestId('webhooks-secret')).toBeVisible()

    // Select first endpoint and send test.
    const row = page.locator('[data-testid^="webhooks-row-"]').first()
    await row.click()
    await page.getByTestId('webhooks-send-test').click()
    await expect(page.getByTestId('webhooks-deliveries')).toContainText('webhook.test')

    // Export
    await page.goto('/settings/exports')
    await expect(page.getByTestId('exports-page')).toBeVisible()
    await page.getByTestId('export-accounts').click()

    // Wait until a ready job appears.
    await expect
      .poll(async () => {
        await page.reload()
        const table = page.getByTestId('exports-jobs')
        const text = await table.innerText()
        return text.includes('ready')
      }, { timeout: 15000 })
      .toBe(true)
  })
})

