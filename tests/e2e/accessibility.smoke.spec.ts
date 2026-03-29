import { test, expect } from './fixtures'
import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import type { Result } from 'axe-core'

const PAGES = ['/', '/pricing', '/use-cases', '/compare', '/tour', '/trust'] as const

async function runAxe(page: Page) {
  return await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('[data-axe-exclude="true"]')
    .analyze()
}

function pickSeriousCritical(violations: Result[]) {
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}

test.describe('Accessibility smoke (serious/critical)', () => {
  for (const path of PAGES) {
    test(`axe: ${path}`, async ({ page }) => {
      const res = await page.request.get(path, { failOnStatusCode: false })
      if (res.status() === 404) return
      expect(res.status()).toBeLessThan(500)

      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(250)

      const results = await runAxe(page)
      const bad = pickSeriousCritical(results.violations)
      expect(
        bad,
        `Axe serious/critical violations on ${path}:\n` +
          bad
            .map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes?.length ?? 0} nodes)`)
            .join('\n')
      ).toEqual([])
    })
  }
})

