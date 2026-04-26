import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use) => {
    const token = (process.env.E2E_TOKEN ?? '').trim()
    const headers = token.length > 0 ? { 'x-e2e-token': token } : undefined
    await page.request
      .get('/api/e2e/reset-ratelimits', { failOnStatusCode: false, ...(headers ? { headers } : {}) })
      .catch(() => undefined)
    await use(page)
  },
})

export { expect }

