import { test, expect } from '@playwright/test'
import { setE2ECookies } from './utils'

test.describe('developers + platform surfaces', () => {
  test('developers page renders', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/developers`)
    await expect(page.getByRole('heading', { name: /Developers/i })).toBeVisible()
    await expect(page.getByText(/API routes/i)).toBeVisible()
  })

  test('platform settings page renders for authed team user', async ({ page, baseURL }) => {
    await setE2ECookies({ page, baseURL: baseURL!, authed: true, plan: 'team' })
    await page.goto(`${baseURL}/settings/platform`)
    await expect(page.getByTestId('platform-settings-page')).toBeVisible({ timeout: 15000 })
  })

  test('api settings page renders for authed team user', async ({ page, baseURL }) => {
    await setE2ECookies({ page, baseURL: baseURL!, authed: true, plan: 'team' })
    await page.goto(`${baseURL}/settings/api`)
    await expect(page.getByTestId('api-settings-page')).toBeVisible({ timeout: 15000 })
  })
})

