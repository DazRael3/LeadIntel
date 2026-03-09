import { test, expect } from './fixtures'
import { loginViaUi, requireEnv, setE2ECookies } from './utils'

test.describe('Integrations + actions wave', () => {
  test('integrations settings, queue, and history render for Team', async ({ page }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = requireEnv('E2E_TEAM_EMAIL')
    const password = requireEnv('E2E_TEAM_PASSWORD')

    await setE2ECookies({ page, baseURL, plan: 'team', uid: 'e2e_actions_team', email })
    await loginViaUi({ page, email, password })
    await expect(page).toHaveURL(/\/dashboard/)

    // Dashboard shows the action queue card (empty state is fine).
    await expect(page.getByText('Action queue')).toBeVisible({ timeout: 15000 })

    // Integrations settings (Team-gated) renders catalog + connection + recipes + history.
    await page.goto('/settings/integrations')
    await expect(page.getByTestId('integrations-page')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('integration-catalog')).toBeVisible()
    await expect(page.getByText(/CRM handoff/i)).toBeVisible()
    await expect(page.getByText(/Sequencer handoff/i)).toBeVisible()
    await expect(page.getByText(/Default handoff destination/i)).toBeVisible()
    await expect(page.getByText(/Action recipes/i)).toBeVisible()
    await expect(page.getByText(/Recent delivery activity/i)).toBeVisible()

    // Queue page loads.
    await page.goto('/dashboard/actions')
    await expect(page.getByTestId('actions-page')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Workspace queue for handoffs and delivery tasks.')).toBeVisible()

    // Delivery history page loads.
    await page.goto('/settings/integrations/history')
    await expect(page.getByTestId('integrations-history-page')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Sanitized delivery activity/i)).toBeVisible()
  })
})

