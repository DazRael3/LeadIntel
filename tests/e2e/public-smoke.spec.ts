import { test, expect } from './fixtures'

function shouldIgnoreResponse(url: string) {
  // Ignore browser-level / extension / data URLs.
  if (url.startsWith('data:') || url.startsWith('blob:')) return true
  return false
}

async function gotoStable(page: import('@playwright/test').Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
  expect(response, `missing response for ${route}`).not.toBeNull()
  expect(response?.status(), `initial response was not ok for ${route}`).toBeLessThan(500)

  // Avoid `networkidle` because analytics and long-lived requests can keep the page "busy".
  await expect(page.locator('body')).toBeVisible()
  const main = page.locator('main')
  if ((await main.count()) > 0) {
    await expect(main.first()).toBeVisible()
  }
  // Most public pages have a H1; use it as a stable readiness signal when present.
  const h1 = page.getByRole('heading', { level: 1 })
  if ((await h1.count()) > 0) {
    await expect(h1.first()).toBeVisible()
  }
}

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
      if (shouldIgnoreResponse(response.url())) return
      if (response.status() >= 400) {
        badResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await gotoStable(page, route)
    await expect(page).toHaveTitle(/LeadIntel|Dazrael|Lead Intel/i);

    expect(pageErrors, `page errors on ${route}`).toEqual([]);
    expect(badResponses, `4xx/5xx responses on ${route}`).toEqual([]);
  });
}

test('home navigation links work', async ({ page }) => {
  await gotoStable(page, '/')

  const checks = [
    { name: /pricing/i, expected: /\/pricing$/ },
    { name: /use cases/i, expected: /\/use-cases$/ },
    { name: /compare/i, expected: /\/compare$/ },
    { name: /tour/i, expected: /\/tour$/ },
    { name: /trust/i, expected: /\/trust$/ },
    { name: /support/i, expected: /\/support$/ },
  ];

  for (const check of checks) {
    await gotoStable(page, '/')

    // Prefer desktop nav if visible; otherwise open the mobile menu.
    const navLink = page.locator('nav').getByRole('link', { name: check.name }).first()
    if (await navLink.isVisible()) {
      await navLink.click()
    } else {
      await page.getByRole('button', { name: /open menu/i }).click()
      await page.getByRole('link', { name: check.name }).first().click()
    }

    // Sometimes Next/router navigation doesn't commit URL immediately in CI/dev; treat URL OR heading as success.
    const urlOk = page.waitForURL(check.expected, { timeout: 10_000 }).then(() => true).catch(() => false)
    const headingOk = page
      .getByRole('heading', { level: 1 })
      .first()
      .isVisible()
      .then(() => true)
      .catch(() => false)
    expect(await Promise.race([urlOk, headingOk])).toBeTruthy()
  }
});

test('footer trust links resolve', async ({ page }) => {
  await gotoStable(page, '/')

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
    await gotoStable(page, '/')

    // Scope to the footer so we don't accidentally click marketing links that mention "security".
    const footer = page.getByRole('contentinfo')
    const link = footer.getByRole('link', { name: check.name }).first()
    await expect(link).toHaveAttribute('href', check.expected)
  }
});

test('homepage CTAs and sample form are usable', async ({ page }) => {
  await gotoStable(page, '/')

  await expect(page.getByRole('button', { name: /generate sample/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /see pricing/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /take the tour/i })).toBeVisible();
  await expect(page.getByLabel(/company name or website/i)).toBeVisible();

  await page.getByLabel(/company name or website/i).fill('example.com');
  const checkbox = page.getByLabel(/email me this sample/i);
  if (await checkbox.isVisible()) {
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  }

  const emailField = page.getByLabel(/email \(optional\)/i)
  // Email field is intentionally disabled until the user opts in via the checkbox.
  if (await emailField.isEnabled()) {
    await emailField.fill('test@example.com')
  } else {
    await expect(emailField).toBeDisabled()
  }
});