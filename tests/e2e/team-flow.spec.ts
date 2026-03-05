import { test, expect } from './fixtures'
import { loginViaUi, requireEnv, setE2ECookies } from './utils'

test.describe('Team flow', () => {
  test('invite + templates approval + audit visibility', async ({ page, browser }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
    const email = requireEnv('E2E_TEAM_EMAIL')
    const password = requireEnv('E2E_TEAM_PASSWORD')
    const inviteeEmail = requireEnv('E2E_INVITEE_EMAIL')

    await setE2ECookies({ page, baseURL, plan: 'team', uid: 'e2e_team_owner', email })
    await loginViaUi({ page, email, password })
    await expect(page).toHaveURL(/\/dashboard/)

    // Invite member
    await page.goto('/settings/team')
    await expect(page.getByTestId('team-page')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('team-invite-email').fill(inviteeEmail)
    await page.getByTestId('team-invite-role').selectOption('member')
    await page.getByTestId('team-invite-submit').click()
    await expect(page.getByTestId('team-invite-copy-link')).toBeVisible()
    const inviteLink = await page.locator('[data-testid="team-invite-copy-link"]').locator('..').locator('div').first().innerText()
    expect(inviteLink).toContain('/settings/team?accept=')

    // Invitee accepts in separate context
    const ctx = await browser.newContext()
    const inviteePage = await ctx.newPage()
    await setE2ECookies({ page: inviteePage, baseURL, plan: 'team', uid: 'e2e_team_member', email: inviteeEmail })
    await loginViaUi({ page: inviteePage, email: inviteeEmail, password: requireEnv('E2E_TEAM_PASSWORD') })
    await inviteePage.goto(inviteLink)
    await expect(inviteePage).toHaveURL(/\/settings\/team/)

    // Owner creates set + template + approves
    await page.goto('/settings/templates')
    await expect(page.getByTestId('templates-settings-page')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('templates-new-set-name').fill('Default set')
    await page.getByTestId('templates-new-set-description').fill('Team standard templates')
    await page.getByTestId('templates-new-set-submit').click()
    await page.getByTestId('templates-create').click()
    await page.getByTestId('templates-form-slug').fill('funding-email-1')
    await page.getByTestId('templates-form-title').fill('Funding email #1')
    await page.getByTestId('templates-form-trigger').fill('Funding')
    await page.getByTestId('templates-form-persona').fill('AE')
    await page.getByTestId('templates-form-length').fill('short')
    await page.getByTestId('templates-form-body').fill('Hi {{company}} — saw {{trigger}}. Worth a quick note?')
    await page.getByTestId('templates-form-save').click()

    // Approve latest draft (first row)
    const approveBtn = page.locator('[data-testid^="templates-approve-"]').first()
    await expect(approveBtn).toBeVisible()
    await approveBtn.click()

    // Member view sees approved templates (and page loads)
    await inviteePage.goto('/settings/templates')
    await expect(inviteePage.getByTestId('templates-settings-page')).toBeVisible({ timeout: 15000 })

    // Audit page contains entries
    await page.goto('/settings/audit')
    await expect(page.getByTestId('audit-page')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/member\.invited|template\.approved/i).first()).toBeVisible()
  })
})

