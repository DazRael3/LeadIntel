import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

type AuditScope = 'public' | 'authed' | 'all'

type AuditEvent =
  | { type: 'console'; level: string; text: string; url: string | null }
  | { type: 'pageerror'; message: string }
  | { type: 'requestfailed'; url: string; method: string; failure: string | null }
  | { type: 'response'; url: string; method: string; status: number }

type PageResult = {
  route: string
  url: string
  ok: boolean
  title: string
  metaDescription: string | null
  canonical: string | null
  durationMs: number
  screenshotDesktop: string
  screenshotMobile: string
  htmlPath: string
  accessibilityPath: string
  issues: { consoleErrors: number; pageErrors: number; failedRequests: number; http4xx5xx: number }
}

function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name]
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  return fallback
}

function parseCsv(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function isoSlug(d: Date): string {
  return d.toISOString().replaceAll(':', '-')
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

async function login(page: Page, baseUrl: string, email: string, password: string): Promise<void> {
  const loginUrl = new URL('/login?mode=signin&redirect=%2Fdashboard', baseUrl).toString()
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' })

  // Use stable data-testid selectors from LoginClient.tsx
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()

  // Dashboard redirect indicates success.
  await page.waitForURL('**/dashboard**', { timeout: 45_000 })
}

async function collectMeta(page: Page): Promise<{ title: string; metaDescription: string | null; canonical: string | null }> {
  const title = await page.title().catch(() => '')
  const metaDescription = await page
    .locator('meta[name="description"]')
    .first()
    .getAttribute('content')
    .catch(() => null)
  const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href').catch(() => null)
  return { title, metaDescription: metaDescription ?? null, canonical: canonical ?? null }
}

async function auditRoute(args: {
  page: Page
  baseUrl: string
  route: string
  outDir: string
}): Promise<PageResult> {
  const started = Date.now()
  const url = new URL(args.route, args.baseUrl).toString()

  const events: AuditEvent[] = []
  const onConsole = (msg: any) => {
    events.push({ type: 'console', level: msg.type?.() ?? 'log', text: msg.text?.() ?? '', url: msg.location?.().url ?? null })
  }
  const onPageError = (err: Error) => events.push({ type: 'pageerror', message: err.message })
  const onRequestFailed = (req: any) =>
    events.push({ type: 'requestfailed', url: req.url?.() ?? '', method: req.method?.() ?? 'GET', failure: req.failure?.()?.errorText ?? null })
  const onResponse = (res: any) =>
    events.push({ type: 'response', url: res.url?.() ?? '', method: res.request?.().method?.() ?? 'GET', status: res.status?.() ?? 0 })

  args.page.on('console', onConsole)
  args.page.on('pageerror', onPageError)
  args.page.on('requestfailed', onRequestFailed)
  args.page.on('response', onResponse)

  let ok = true
  try {
    const resp = await args.page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
    const status = resp?.status() ?? 0
    if (status >= 400) ok = false
  } catch {
    ok = false
  }

  // Give client hydration a moment for consistent screenshots.
  await args.page.waitForTimeout(600)

  const meta = await collectMeta(args.page)
  const html = await args.page.content().catch(() => '')

  const safeName = args.route.replaceAll('/', '_').replaceAll('?', '_').replaceAll('&', '_').replace(/^_+/, '') || 'root'
  const htmlPath = path.join(args.outDir, `${safeName}.html`)
  const eventsPath = path.join(args.outDir, `${safeName}.events.json`)
  const a11yPath = path.join(args.outDir, `${safeName}.a11y.json`)

  await fs.writeFile(htmlPath, html, 'utf8')
  await writeJson(eventsPath, events)

  // Best-effort accessibility snapshot (not a full audit, but useful structure).
  // Playwright's accessibility API isn't typed on the non-test `playwright` Page type in some versions,
  // so call it via a safe cast.
  const a11y = await (args.page as unknown as { accessibility?: { snapshot?: () => Promise<unknown> } })
    .accessibility?.snapshot?.()
    .catch(() => null)
  await writeJson(a11yPath, a11y ?? null)

  const durationMs = Date.now() - started
  const consoleErrors = events.filter((e) => e.type === 'console' && (e as any).level === 'error').length
  const pageErrors = events.filter((e) => e.type === 'pageerror').length
  const failedRequests = events.filter((e) => e.type === 'requestfailed').length
  const http4xx5xx = events.filter((e) => e.type === 'response' && (e as any).status >= 400).length

  // Screenshots handled outside (desktop/mobile) so we can reuse the same page load.
  return {
    route: args.route,
    url,
    ok,
    title: meta.title,
    metaDescription: meta.metaDescription,
    canonical: meta.canonical,
    durationMs,
    screenshotDesktop: '',
    screenshotMobile: '',
    htmlPath,
    accessibilityPath: a11yPath,
    issues: { consoleErrors, pageErrors, failedRequests, http4xx5xx },
  }
}

async function withBrowser<T>(fn: (b: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ headless: true })
  try {
    return await fn(browser)
  } finally {
    await browser.close()
  }
}

async function newContext(
  browser: Browser,
  viewport: { width: number; height: number },
  storageStatePath?: string | null
): Promise<BrowserContext> {
  return await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
    storageState: storageStatePath ?? undefined,
  })
}

function defaultPublicRoutes(): string[] {
  return ['/', '/pricing', '/use-cases', '/compare', '/tour', '/trust', '/version', '/status', '/support', '/templates']
}

function defaultAuthedRoutes(): string[] {
  return [
    '/api/workspaces/current', // triggers workspace bootstrap in many deployments
    '/dashboard',
    '/competitive-report',
    '/dashboard/actions',
    '/dashboard/command-center',
    '/dashboard/executive',
    '/settings/platform',
    '/settings/partner-access',
    '/settings/templates',
    '/settings/integrations',
    '/settings/sources',
    '/settings/team',
  ]
}

async function main(): Promise<void> {
  const baseUrl = env('AUDIT_BASE_URL', 'http://localhost:3000')!
  const scope = (env('AUDIT_SCOPE', 'all') as AuditScope) ?? 'all'
  const email = env('AUDIT_EMAIL')
  const password = env('AUDIT_PASSWORD')
  const storageStatePath = env('AUDIT_STORAGE_STATE')
  const outRoot = env('AUDIT_OUTPUT_DIR', path.join(process.cwd(), 'admin-reports', 'ai-site-audit'))!

  const now = new Date()
  const outDir = path.join(outRoot, isoSlug(now))
  const outPages = path.join(outDir, 'pages')
  const outShots = path.join(outDir, 'screenshots')
  await ensureDir(outPages)
  await ensureDir(outShots)

  const publicRoutes = parseCsv(env('AUDIT_PUBLIC_ROUTES')).length ? parseCsv(env('AUDIT_PUBLIC_ROUTES')) : defaultPublicRoutes()
  const authedRoutes = parseCsv(env('AUDIT_AUTHED_ROUTES')).length ? parseCsv(env('AUDIT_AUTHED_ROUTES')) : defaultAuthedRoutes()

  const runPublic = scope === 'public' || scope === 'all'
  const runAuthed = scope === 'authed' || scope === 'all'

  if (runAuthed && !storageStatePath && (!email || !password)) {
    throw new Error('For AUDIT_SCOPE=authed|all, set AUDIT_STORAGE_STATE or (AUDIT_EMAIL + AUDIT_PASSWORD).')
  }

  const results: PageResult[] = []

  await withBrowser(async (browser) => {
    // Desktop pass
    const ctxDesktop = await newContext(browser, { width: 1280, height: 800 }, storageStatePath ?? null)
    const pageDesktop = await ctxDesktop.newPage()

    if (runAuthed && !storageStatePath) {
      await login(pageDesktop, baseUrl, email!, password!)
    }

    const routesDesktop = [
      ...(runPublic ? publicRoutes : []),
      ...(runAuthed ? authedRoutes : []),
    ]

    for (const route of routesDesktop) {
      const r = await auditRoute({ page: pageDesktop, baseUrl, route, outDir: outPages })
      const safeName = route.replaceAll('/', '_').replaceAll('?', '_').replaceAll('&', '_').replace(/^_+/, '') || 'root'
      const shotPath = path.join(outShots, `${safeName}.desktop.png`)
      await pageDesktop.screenshot({ path: shotPath, fullPage: true }).catch(() => null)
      r.screenshotDesktop = shotPath
      results.push(r)
    }

    await ctxDesktop.close()

    // Mobile pass (screenshots only, reuse public/authed set)
    const ctxMobile = await newContext(browser, { width: 390, height: 844 }, storageStatePath ?? null)
    const pageMobile = await ctxMobile.newPage()
    if (runAuthed && !storageStatePath) {
      await login(pageMobile, baseUrl, email!, password!)
    }

    for (const r of results) {
      // Only screenshot routes we actually ran (avoid duplicates).
      const route = r.route
      try {
        const url = new URL(route, baseUrl).toString()
        await pageMobile.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
        await pageMobile.waitForTimeout(400)
        const safeName = route.replaceAll('/', '_').replaceAll('?', '_').replaceAll('&', '_').replace(/^_+/, '') || 'root'
        const shotPath = path.join(outShots, `${safeName}.mobile.png`)
        await pageMobile.screenshot({ path: shotPath, fullPage: true })
        r.screenshotMobile = shotPath
      } catch {
        r.screenshotMobile = ''
      }
    }

    await ctxMobile.close()
  })

  // Summaries
  const summary = {
    baseUrl,
    scope,
    generatedAt: now.toISOString(),
    totals: {
      pages: results.length,
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      consoleErrors: results.reduce((n, r) => n + r.issues.consoleErrors, 0),
      pageErrors: results.reduce((n, r) => n + r.issues.pageErrors, 0),
      failedRequests: results.reduce((n, r) => n + r.issues.failedRequests, 0),
      http4xx5xx: results.reduce((n, r) => n + r.issues.http4xx5xx, 0),
    },
    results,
  }

  await writeJson(path.join(outDir, 'summary.json'), summary)

  const lines: string[] = []
  lines.push(`# LeadIntel AI site audit bundle`)
  lines.push(``)
  lines.push(`- Base URL: \`${baseUrl}\``)
  lines.push(`- Scope: \`${scope}\``)
  lines.push(`- Generated: \`${now.toISOString()}\``)
  lines.push(`- Pages: **${summary.totals.pages}** (ok: ${summary.totals.ok}, failed: ${summary.totals.failed})`)
  lines.push(`- Console errors: **${summary.totals.consoleErrors}**, page errors: **${summary.totals.pageErrors}**`)
  lines.push(`- Failed requests: **${summary.totals.failedRequests}**, HTTP 4xx/5xx: **${summary.totals.http4xx5xx}**`)
  lines.push(``)
  lines.push(`## Results`)
  for (const r of results) {
    const flag = r.ok ? 'OK' : 'FAIL'
    lines.push(`- **${flag}** \`${r.route}\` → \`${r.title || '(no title)'}\``)
    if (!r.ok) lines.push(`  - URL: \`${r.url}\``)
    if (r.metaDescription) lines.push(`  - Description: ${r.metaDescription}`)
    if (r.canonical) lines.push(`  - Canonical: ${r.canonical}`)
    if (r.issues.consoleErrors || r.issues.pageErrors || r.issues.failedRequests || r.issues.http4xx5xx) {
      lines.push(
        `  - Issues: consoleErrors=${r.issues.consoleErrors}, pageErrors=${r.issues.pageErrors}, failedRequests=${r.issues.failedRequests}, http4xx5xx=${r.issues.http4xx5xx}`
      )
    }
    lines.push(`  - Desktop screenshot: \`${path.relative(process.cwd(), r.screenshotDesktop)}\``)
    lines.push(`  - Mobile screenshot: \`${path.relative(process.cwd(), r.screenshotMobile || '')}\``)
    lines.push(`  - HTML: \`${path.relative(process.cwd(), r.htmlPath)}\``)
    lines.push(`  - Accessibility snapshot: \`${path.relative(process.cwd(), r.accessibilityPath)}\``)
  }
  await fs.writeFile(path.join(outDir, 'REPORT.md'), lines.join('\n') + '\n', 'utf8')

  // eslint-disable-next-line no-console
  console.log(`Audit complete. Output written to: ${outDir}`)
}

void main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[aiSiteAudit] failed', err)
  process.exitCode = 1
})

