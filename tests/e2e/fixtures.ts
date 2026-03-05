import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.request.get('/api/e2e/reset-ratelimits', { failOnStatusCode: false }).catch(() => undefined)
    await use(page)
  },
})

export { expect }

