import { test, expect } from '@playwright/test';

const routes = [
  '/',
  '/pricing',
  '/use-cases',
  '/compare',
  '/tour',
  '/trust',
  '/support',
  '/how-scoring-works',
  '/status',
  '/version',
];

for (const route of routes) {
  test(`public route loads cleanly: ${route}`, async ({ page }) => {
    const pageErrors: string[] = [];
    const badResponses: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        badResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response, `missing response for ${route}`).not.toBeNull();
    expect(response?.ok(), `initial response was not ok for ${route}`).toBeTruthy();

    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/LeadIntel|Dazrael|Lead Intel/i);

    expect(pageErrors, `page errors on ${route}`).toEqual([]);
    expect(badResponses, `4xx/5xx responses on ${route}`).toEqual([]);
  });
}

test('home navigation links work', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const checks = [
    { name: /pricing/i, expected: /\/pricing$/ },
    { name: /use cases/i, expected: /\/use-cases$/ },
    { name: /compare/i, expected: /\/compare$/ },
    { name: /tour/i, expected: /\/tour$/ },
    { name: /trust/i, expected: /\/trust$/ },
    { name: /support/i, expected: /\/support$/ },
  ];

  for (const check of checks) {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: check.name }).first().click();
    await expect(page).toHaveURL(check.expected);
  }
});

test('footer trust links resolve', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const checks = [
    { name: /security/i, expected: /\/security$/ },
    { name: /privacy/i, expected: /\/privacy$/ },
    { name: /terms/i, expected: /\/terms$/ },
    { name: /acceptable use/i, expected: /\/acceptable-use$/ },
    { name: /subprocessors/i, expected: /\/subprocessors$/ },
    { name: /dpa/i, expected: /\/dpa$/ },
    { name: /status/i, expected: /\/status$/ },
    { name: /version/i, expected: /\/version$/ },
  ];

  for (const check of checks) {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: check.name }).first().click();
    await expect(page).toHaveURL(check.expected);
  }
});

test('homepage CTAs and sample form are usable', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page.getByRole('button', { name: /generate sample/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /see pricing/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /take the tour/i })).toBeVisible();
  await expect(page.getByLabel(/company name or website/i)).toBeVisible();

  await page.getByLabel(/company name or website/i).fill('example.com');
  await page.getByLabel(/email \(optional\)/i).fill('test@example.com');

  const checkbox = page.getByLabel(/email me this sample/i);
  if (await checkbox.isVisible()) {
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  }
});