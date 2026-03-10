import { test, expect } from '@playwright/test'
import { signReviewToken } from '@/lib/review/security'

test('review mode link lands without credentials', async ({ page }) => {
  process.env.REVIEW_SIGNING_SECRET = process.env.REVIEW_SIGNING_SECRET || 'e2e_review_secret'
  const exp = Math.floor(Date.now() / 1000) + 10 * 60
  const token = signReviewToken({ v: 1, aud: 'review_link', linkId: 'e2e-link', exp })

  await page.goto(`/review/pricing?token=${encodeURIComponent(token)}`)
  await expect(page).toHaveURL(/\/pricing/)
  await expect(page.getByText('Review Mode')).toBeVisible()
})

