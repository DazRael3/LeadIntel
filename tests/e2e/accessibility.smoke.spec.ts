import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = [
  '/',
  '/pricing',
  '/use-cases',
  '/compare',
  '/tour',
  '/trust',
  '/support',
  '/how-scoring-works',
];

for (const route of routes) {
  test(`no serious accessibility violations: ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page })
      .include('body')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const seriousOrCritical = results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact || '')
    );

    expect(
      seriousOrCritical,
      JSON.stringify(seriousOrCritical, null, 2)
    ).toEqual([]);
  });
}