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
  // Nav click → client-side routing can be slow under multi-project load (notably WebKit).
  // Keep coverage (must open menu / click links / navigate), but allow enough time to avoid false negatives.
  test.setTimeout(60_000)
  await gotoStable(page, '/')

  async function clickAndWaitForUrl(args: {
    locator: import('@playwright/test').Locator
    expected: RegExp
  }) {
    const timeoutMs = 12_000
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await Promise.all([
          page.waitForURL(args.expected, { timeout: timeoutMs, waitUntil: 'domcontentloaded' }),
          args.locator.click(),
        ])
        return
      } catch (error) {
        if (attempt === 1) throw error
        // WebKit can occasionally miss the first click/navigation under load; retry once.
        await page.waitForTimeout(50)
      }
    }
  }

  async function openPublicMobileMenu() {
    const nav = page.locator('nav').filter({ has: page.getByRole('link', { name: /leadintel/i }) }).first()
    const openMenu = nav.getByRole('button', { name: /open.*menu/i }).first()
    // Mobile Safari can occasionally miss the first click during hydration; retry a few times.
    for (let attempt = 0; attempt < 4; attempt++) {
      const expanded = await openMenu.getAttribute('aria-expanded')
      if (expanded === 'true') break
      await openMenu.click()
      try {
        await expect(openMenu).toHaveAttribute('aria-expanded', 'true', { timeout: 1500 })
        break
      } catch {
        // best-effort retry
      }
      await page.waitForTimeout(100)
    }

    await expect(openMenu).toHaveAttribute('aria-expanded', 'true')
    const menu = page.getByRole('dialog')
    await expect(menu).toBeVisible()
    return menu
  }

  async function isDesktopNavVisible(nav: import('@playwright/test').Locator) {
    // Avoid locator.isVisible() flaking due to animation/hydration; use a short deterministic check.
    return await nav
      .getByRole('button', { name: /open.*menu/i })
      .first()
      .isVisible()
      .then((v) => !v)
      .catch(() => true)
  }

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
    const nav = page.locator('nav').filter({ has: page.getByRole('link', { name: /leadintel/i }) }).first()
    const desktopLink = nav.getByRole('link', { name: check.name }).first()
    const useDesktop = await isDesktopNavVisible(nav)
    if (useDesktop) {
      await expect(desktopLink).toHaveAttribute('href', check.expected)
      await clickAndWaitForUrl({ locator: desktopLink, expected: check.expected })
    } else {
      const menu = await openPublicMobileMenu()
      const link = menu.getByRole('link', { name: check.name }).first()
      await expect(link).toHaveAttribute('href', check.expected)
      await clickAndWaitForUrl({ locator: link, expected: check.expected })
    }

    // Verify we landed on a real page, not just a stale heading.
    await expect(page.locator('main')).toBeVisible()
    const h1 = page.getByRole('heading', { level: 1 })
    if ((await h1.count()) > 0) {
      await expect(h1.first()).toBeVisible()
    }
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
    // Checkbox may be present but disabled if email delivery isn't configured in the environment.
    // This should never be a "clickable but silently failing" flow.
    const enabled = await checkbox.isEnabled().catch(() => false);
    if (enabled) {
      await checkbox.check();
      await expect(checkbox).toBeChecked();
    } else {
      await expect(checkbox).toBeDisabled();
    }
  }

  const emailField = page.getByLabel(/email \(optional\)/i)
  // Email field is intentionally disabled until the user opts in via the checkbox.
  if (await emailField.isEnabled()) {
    await emailField.fill('test@example.com')
  } else {
    await expect(emailField).toBeDisabled()
  }
});

test('og image endpoint returns non-empty png', async ({ page }) => {
  const res = await page.request.get('/api/og?title=Playwright&subtitle=Smoke');
  expect(res.status(), 'OG endpoint should return 200').toBe(200);
  const ct = res.headers()['content-type'] || '';
  expect(ct, 'OG endpoint should be image/png').toContain('image/png');
  const buf = await res.body();
  expect(buf.length, 'OG endpoint returned empty body').toBeGreaterThan(200);
});