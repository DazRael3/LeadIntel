import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

type AuditScope = 'public' | 'logged_in' | 'all'
type RunMode = 'public' | 'logged_in'

type LinkInfo = { href: string; text: string }

type RouteRecord = {
  route: string
  mode: RunMode
  discoveredFrom: string[]
}

type ConsoleError = { route: string; mode: RunMode; level: string; text: string; url: string | null }
type NetworkFailure =
  | { route: string; mode: RunMode; kind: 'requestfailed'; url: string; method: string; failure: string | null }
  | { route: string; mode: RunMode; kind: 'http_error'; url: string; method: string; status: number }

type RouteCapture = {
  route: string
  mode: RunMode
  finalUrl: string
  ok: boolean
  status: number | null
  title: string
  metaDescription: string | null
  canonical: string | null
  h1: string | null
  headings: string[]
  topCtas: string[]
  footerLinks: LinkInfo[]
  navLinks: LinkInfo[]
  internalLinks: string[]
  overflowX: boolean
  consoleErrorCount: number
  failedRequestCount: number
  http4xx5xxCount: number
  durationMs: number
  screenshotDesktop: string
  screenshotMobile: string
  htmlPath: string
  eventsPath: string
}

type HeuristicIssue = {
  route: string
  mode: RunMode
  severity: 'high' | 'medium' | 'low'
  code:
    | 'MISSING_H1'
    | 'MISSING_META_DESCRIPTION'
    | 'WEAK_TITLE'
    | 'DUPLICATE_TITLE'
    | 'PUBLIC_API_LINKS'
    | 'PUBLIC_DEBUG_WORDING'
    | 'HTTP_4XX_5XX'
    | 'CONSOLE_ERRORS'
    | 'FAILED_REQUESTS'
    | 'OVERFLOW_X'
  message: string
  details?: Record<string, unknown>
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

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function timestampSlug(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mi = pad2(d.getMinutes())
  const ss = pad2(d.getSeconds())
  return `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function normalizeScope(raw: string | undefined): AuditScope {
  const v = (raw ?? 'all').trim().toLowerCase()
  if (v === 'public') return 'public'
  if (v === 'logged_in' || v === 'logged-in' || v === 'authed' || v === 'authenticated') return 'logged_in'
  return 'all'
}

function safeFileStem(s: string): string {
  return s
    .replaceAll('://', '__')
    .replaceAll('/', '_')
    .replaceAll('?', '_')
    .replaceAll('&', '_')
    .replaceAll('=', '_')
    .replaceAll('#', '_')
    .replace(/^_+/, '') || 'root'
}

function normalizeRoute(routeOrUrl: string, baseUrl: string): string | null {
  try {
    const u = new URL(routeOrUrl, baseUrl)
    const base = new URL(baseUrl)
    if (u.origin !== base.origin) return null
    const pathname = u.pathname || '/'
    const search = u.search || ''
    // Normalize trailing slash except root.
    const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
    // Strip obviously sensitive token-y params.
    const sp = new URLSearchParams(search)
    if (sp.has('token') || sp.has('access_token') || sp.has('refresh_token')) {
      return p
    }
    const qs = sp.toString()
    return qs ? `${p}?${qs}` : p
  } catch {
    return null
  }
}

function isSkippableRoute(route: string): boolean {
  const lower = route.toLowerCase()
  if (lower.startsWith('/api/')) return true
  if (lower.startsWith('/auth/')) return true
  if (lower.includes('logout')) return true
  if (lower.startsWith('/review/')) return true
  return false
}

function defaultPublicSeed(): string[] {
  return [
    '/',
    '/pricing',
    '/use-cases',
    '/compare',
    '/tour',
    '/trust',
    '/support',
    '/status',
    '/version',
    '/roadmap',
    '/templates',
    '/how-scoring-works',
  ]
}

function defaultLoggedInSeed(): string[] {
  return [
    '/dashboard',
    '/competitive-report',
    '/dashboard/actions',
    '/dashboard/command-center',
    '/dashboard/executive',
    '/settings/templates',
    '/settings/integrations',
    '/settings/sources',
    '/settings/workspace',
    '/pricing',
    '/support',
  ]
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

async function collectMeta(page: Page): Promise<{ title: string; metaDescription: string | null; canonical: string | null }> {
  const title = await page.title().catch(() => '')
  const metaDescription = await page.locator('meta[name="description"]').first().getAttribute('content').catch(() => null)
  const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href').catch(() => null)
  return { title: title ?? '', metaDescription: metaDescription ?? null, canonical: canonical ?? null }
}

async function extractH1(page: Page): Promise<string | null> {
  const raw = await page.locator('h1').first().innerText().catch(() => '')
  const t = (raw ?? '').replace(/\s+/g, ' ').trim()
  return t.length ? t : null
}

async function extractHeadings(page: Page): Promise<string[]> {
  return await page
    .evaluate(() => {
      const hs = Array.from(document.querySelectorAll('h1,h2,h3'))
      const out: string[] = []
      for (const h of hs) {
        const text = (h as HTMLElement).innerText.replace(/\s+/g, ' ').trim()
        if (!text) continue
        if (!out.includes(text)) out.push(text)
        if (out.length >= 8) break
      }
      return out
    })
    .catch(() => [])
}

async function extractTopCtas(page: Page): Promise<string[]> {
  return await page
    .evaluate(() => {
      const els = Array.from(document.querySelectorAll('a,button'))
      const labels: string[] = []
      for (const el of els) {
        const rect = (el as HTMLElement).getBoundingClientRect()
        if (rect.height < 20 || rect.width < 40) continue
        if (rect.top < 0 || rect.top > 900) continue
        const style = window.getComputedStyle(el as HTMLElement)
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
        const text = ((el as HTMLElement).innerText || (el as HTMLElement).textContent || '').replace(/\s+/g, ' ').trim()
        if (!text || text.length > 80) continue
        if (!labels.includes(text)) labels.push(text)
        if (labels.length >= 8) break
      }
      return labels
    })
    .catch(() => [])
}

async function extractLinkInfo(page: Page, selector: string): Promise<LinkInfo[]> {
  return await page
    .locator(selector)
    .evaluateAll((els) => {
      const out: Array<{ href: string; text: string }> = []
      for (const el of els) {
        const a = el as HTMLAnchorElement
        const href = (a.getAttribute('href') ?? '').trim()
        if (!href) continue
        const text = (a.textContent ?? '').replace(/\s+/g, ' ').trim()
        out.push({ href, text })
      }
      return out
    })
    .catch(() => [])
}

async function extractInternalLinks(page: Page, baseUrl: string): Promise<string[]> {
  const links = await extractLinkInfo(page, 'a[href]')
  const out = new Set<string>()
  for (const l of links) {
    const href = l.href
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) continue
    const normalized = normalizeRoute(href, baseUrl)
    if (!normalized) continue
    if (isSkippableRoute(normalized)) continue
    out.add(normalized)
  }
  return Array.from(out)
}

async function detectOverflowX(page: Page): Promise<boolean> {
  return await page
    .evaluate(() => {
      const doc = document.documentElement
      const body = document.body
      const scrollW = Math.max(doc?.scrollWidth ?? 0, body?.scrollWidth ?? 0)
      const clientW = doc?.clientWidth ?? window.innerWidth
      return scrollW > clientW + 4
    })
    .catch(() => false)
}

function looksLikeDebugWording(text: string): boolean {
  const t = text.toLowerCase()
  return t.includes('debug') || t.includes('internal') || t.includes('admin token') || t.includes('endpoint')
}

async function auditOneRoute(args: {
  page: Page
  baseUrl: string
  route: string
  mode: RunMode
  outHtmlDir: string
  outShotsDir: string
  viewportLabel: 'desktop' | 'mobile'
}): Promise<{
  capture: Omit<RouteCapture, 'screenshotMobile' | 'screenshotDesktop'>
  screenshotPath: string | null
  consoleErrors: ConsoleError[]
  networkFailures: NetworkFailure[]
}> {
  const started = Date.now()
  const url = new URL(args.route, args.baseUrl).toString()

  const consoleErrors: ConsoleError[] = []
  const networkFailures: NetworkFailure[] = []
  let consoleErrorCount = 0
  let failedRequestCount = 0
  let http4xx5xxCount = 0

  const events: Array<Record<string, unknown>> = []

  const onConsole = (msg: any) => {
    const level = (msg?.type?.() ?? 'log') as string
    const text = (msg?.text?.() ?? '') as string
    const locUrl = (msg?.location?.().url ?? null) as string | null
    events.push({ type: 'console', level, text, url: locUrl })
    if (level === 'error') {
      consoleErrorCount += 1
      consoleErrors.push({ route: args.route, mode: args.mode, level, text, url: locUrl })
    }
  }
  const onPageError = (err: Error) => {
    events.push({ type: 'pageerror', message: err.message })
  }
  const onRequestFailed = (req: any) => {
    failedRequestCount += 1
    const method = (req?.method?.() ?? 'GET') as string
    const u = (req?.url?.() ?? '') as string
    const failure = (req?.failure?.()?.errorText ?? null) as string | null
    events.push({ type: 'requestfailed', method, url: u, failure })
    networkFailures.push({ route: args.route, mode: args.mode, kind: 'requestfailed', url: u, method, failure })
  }
  const onResponse = (res: any) => {
    const status = (res?.status?.() ?? 0) as number
    const req = res?.request?.()
    const method = (req?.method?.() ?? 'GET') as string
    const u = (res?.url?.() ?? '') as string
    events.push({ type: 'response', method, url: u, status })
    if (status >= 400) {
      http4xx5xxCount += 1
      networkFailures.push({ route: args.route, mode: args.mode, kind: 'http_error', url: u, method, status })
    }
  }

  args.page.on('console', onConsole)
  args.page.on('pageerror', onPageError)
  args.page.on('requestfailed', onRequestFailed)
  args.page.on('response', onResponse)

  let ok = true
  let status: number | null = null
  try {
    const resp = await args.page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
    status = resp?.status() ?? null
    if (status && status >= 400) ok = false
  } catch {
    ok = false
  }

  await args.page.waitForTimeout(550)

  const finalUrl = args.page.url() || url
  const meta = await collectMeta(args.page)
  const h1 = await extractH1(args.page)
  const headings = await extractHeadings(args.page)
  const topCtas = await extractTopCtas(args.page)
  const footerLinks = await extractLinkInfo(args.page, 'footer a[href]')
  const navLinks = await extractLinkInfo(args.page, 'nav a[href]')
  const internalLinks = await extractInternalLinks(args.page, args.baseUrl)
  const overflowX = await detectOverflowX(args.page)

  const html = await args.page.content().catch(() => '')
  const stem = safeFileStem(`${args.mode}_${args.route}`)
  const htmlPath = path.join(args.outHtmlDir, `${stem}.html`)
  const eventsPath = path.join(args.outHtmlDir, `${stem}.events.json`)
  await fs.writeFile(htmlPath, html, 'utf8')
  await writeJson(eventsPath, events)

  // Screenshot
  let screenshotPath: string | null = null
  try {
    screenshotPath = path.join(args.outShotsDir, `${stem}.${args.viewportLabel}.png`)
    await args.page.screenshot({ path: screenshotPath, fullPage: true })
  } catch {
    screenshotPath = null
  }

  // Remove listeners
  args.page.off('console', onConsole)
  args.page.off('pageerror', onPageError)
  args.page.off('requestfailed', onRequestFailed)
  args.page.off('response', onResponse)

  const durationMs = Date.now() - started

  return {
    capture: {
      route: args.route,
      mode: args.mode,
      finalUrl,
      ok,
      status,
      title: meta.title,
      metaDescription: meta.metaDescription,
      canonical: meta.canonical,
      h1,
      headings,
      topCtas,
      footerLinks,
      navLinks,
      internalLinks,
      overflowX,
      consoleErrorCount,
      failedRequestCount,
      http4xx5xxCount,
      durationMs,
      htmlPath,
      eventsPath,
    },
    screenshotPath,
    consoleErrors,
    networkFailures,
  }
}

async function main(): Promise<void> {
  const baseUrl = env('AUDIT_BASE_URL', 'http://localhost:3000')!
  const scope = normalizeScope(env('AUDIT_SCOPE'))
  const storageStatePath = env('AUDIT_STORAGE_STATE')
  const outRoot = env('AUDIT_OUTPUT_DIR', path.join(process.cwd(), 'admin-reports', 'ai-site-audit'))!
  const maxRoutes = Number.parseInt(env('AUDIT_MAX_ROUTES', '120') ?? '120', 10)

  const runPublic = scope === 'public' || scope === 'all'
  const runLoggedIn = scope === 'logged_in' || scope === 'all'

  if (runLoggedIn && !storageStatePath) {
    throw new Error('Logged-in audit requires AUDIT_STORAGE_STATE. Run `npm run audit:storage` first.')
  }

  const now = new Date()
  const outDir = path.join(outRoot, timestampSlug(now))
  const outShots = path.join(outDir, 'screenshots')
  const outHtml = path.join(outDir, 'html')
  await ensureDir(outShots)
  await ensureDir(outHtml)

  const routes: RouteRecord[] = []
  const queue: Array<{ route: string; mode: RunMode; from: string }> = []
  const seen = new Set<string>()

  const addRoute = (routeOrUrl: string, mode: RunMode, from: string) => {
    const normalized = normalizeRoute(routeOrUrl, baseUrl)
    if (!normalized) return
    if (isSkippableRoute(normalized)) return
    const key = `${mode}:${normalized}`
    if (seen.has(key)) {
      const rec = routes.find((r) => r.route === normalized && r.mode === mode)
      if (rec && !rec.discoveredFrom.includes(from)) rec.discoveredFrom.push(from)
      return
    }
    seen.add(key)
    routes.push({ route: normalized, mode, discoveredFrom: [from] })
    queue.push({ route: normalized, mode, from })
  }

  const publicSeed = parseCsv(env('AUDIT_PUBLIC_ROUTES')).length ? parseCsv(env('AUDIT_PUBLIC_ROUTES')) : defaultPublicSeed()
  const loggedInSeed = parseCsv(env('AUDIT_LOGGED_IN_ROUTES')).length
    ? parseCsv(env('AUDIT_LOGGED_IN_ROUTES'))
    : defaultLoggedInSeed()

  if (runPublic) for (const r of publicSeed) addRoute(r, 'public', 'seed')
  if (runLoggedIn) for (const r of loggedInSeed) addRoute(r, 'logged_in', 'seed')

  const captures: RouteCapture[] = []
  const consoleErrors: ConsoleError[] = []
  const networkFailures: NetworkFailure[] = []

  await withBrowser(async (browser) => {
    // Desktop contexts
    const ctxPublic = runPublic ? await newContext(browser, { width: 1280, height: 800 }, null) : null
    const pagePublic = ctxPublic ? await ctxPublic.newPage() : null
    const ctxAuthed = runLoggedIn ? await newContext(browser, { width: 1280, height: 800 }, storageStatePath ?? null) : null
    const pageAuthed = ctxAuthed ? await ctxAuthed.newPage() : null

    if (runLoggedIn && pageAuthed) {
      await pageAuthed.goto(new URL('/dashboard', baseUrl).toString(), { waitUntil: 'domcontentloaded' })
      if (pageAuthed.url().includes('/login')) {
        throw new Error('storageState is not authenticated (redirected to /login). Re-run `npm run audit:storage`.')
      }
    }

    while (queue.length > 0 && captures.length < maxRoutes) {
      const item = queue.shift()!
      const page = item.mode === 'logged_in' ? pageAuthed : pagePublic
      if (!page) continue

      const audited = await auditOneRoute({
        page,
        baseUrl,
        route: item.route,
        mode: item.mode,
        outHtmlDir: outHtml,
        outShotsDir: outShots,
        viewportLabel: 'desktop',
      })

      const cap: RouteCapture = {
        ...audited.capture,
        screenshotDesktop: audited.screenshotPath ?? '',
        screenshotMobile: '',
      }
      captures.push(cap)
      consoleErrors.push(...audited.consoleErrors)
      networkFailures.push(...audited.networkFailures)

      // Route discovery: bounded, same-origin internal links only.
      for (const href of cap.internalLinks) {
        addRoute(href, item.mode, item.route)
      }

      // Compare details: discover from compare hub links specifically (even if not in seed).
      if (item.mode === 'public' && item.route === '/compare') {
        for (const href of cap.internalLinks) {
          if (href.startsWith('/compare/') && href !== '/compare') addRoute(href, 'public', '/compare')
        }
      }
    }

    if (ctxPublic) await ctxPublic.close()
    if (ctxAuthed) await ctxAuthed.close()

    // Mobile screenshots for audited routes
    const ctxPublicMobile = runPublic ? await newContext(browser, { width: 390, height: 844 }, null) : null
    const pagePublicMobile = ctxPublicMobile ? await ctxPublicMobile.newPage() : null
    const ctxAuthedMobile = runLoggedIn ? await newContext(browser, { width: 390, height: 844 }, storageStatePath ?? null) : null
    const pageAuthedMobile = ctxAuthedMobile ? await ctxAuthedMobile.newPage() : null

    for (const cap of captures) {
      const page = cap.mode === 'logged_in' ? pageAuthedMobile : pagePublicMobile
      if (!page) continue
      const audited = await auditOneRoute({
        page,
        baseUrl,
        route: cap.route,
        mode: cap.mode,
        outHtmlDir: outHtml,
        outShotsDir: outShots,
        viewportLabel: 'mobile',
      })
      if (audited.screenshotPath) {
        cap.screenshotMobile = audited.screenshotPath
      }
    }

    if (ctxPublicMobile) await ctxPublicMobile.close()
    if (ctxAuthedMobile) await ctxAuthedMobile.close()
  })

  // Heuristics
  const heuristicIssues: HeuristicIssue[] = []
  const titleMap = new Map<string, Array<{ route: string; mode: RunMode }>>()
  for (const c of captures) {
    const title = (c.title ?? '').trim()
    if (!title) continue
    const arr = titleMap.get(title) ?? []
    arr.push({ route: c.route, mode: c.mode })
    titleMap.set(title, arr)
  }

  for (const c of captures) {
    if (!c.h1) {
      heuristicIssues.push({ route: c.route, mode: c.mode, severity: 'high', code: 'MISSING_H1', message: 'Missing H1.' })
    }
    if (!c.metaDescription) {
      heuristicIssues.push({
        route: c.route,
        mode: c.mode,
        severity: 'medium',
        code: 'MISSING_META_DESCRIPTION',
        message: 'Missing meta description.',
      })
    }
    if (!c.title || c.title.trim().length < 6) {
      heuristicIssues.push({ route: c.route, mode: c.mode, severity: 'medium', code: 'WEAK_TITLE', message: 'Weak or missing page title.' })
    }
    if (c.http4xx5xxCount > 0) {
      heuristicIssues.push({
        route: c.route,
        mode: c.mode,
        severity: 'high',
        code: 'HTTP_4XX_5XX',
        message: 'HTTP 4xx/5xx responses occurred while loading this route.',
        details: { count: c.http4xx5xxCount },
      })
    }
    if (c.consoleErrorCount > 0) {
      heuristicIssues.push({
        route: c.route,
        mode: c.mode,
        severity: 'high',
        code: 'CONSOLE_ERRORS',
        message: 'Console errors occurred on this route.',
        details: { count: c.consoleErrorCount },
      })
    }
    if (c.failedRequestCount > 0) {
      heuristicIssues.push({
        route: c.route,
        mode: c.mode,
        severity: 'high',
        code: 'FAILED_REQUESTS',
        message: 'Network request failures occurred on this route.',
        details: { count: c.failedRequestCount },
      })
    }
    if (c.overflowX) {
      heuristicIssues.push({
        route: c.route,
        mode: c.mode,
        severity: 'medium',
        code: 'OVERFLOW_X',
        message: 'Potential horizontal overflow detected.',
      })
    }
    if (c.mode === 'public') {
      const apiLinks = [...c.footerLinks, ...c.navLinks].filter((l) => l.href.startsWith('/api/'))
      if (apiLinks.length > 0) {
        heuristicIssues.push({
          route: c.route,
          mode: c.mode,
          severity: 'medium',
          code: 'PUBLIC_API_LINKS',
          message: 'Public surface includes /api/* link(s) in nav/footer.',
          details: { links: apiLinks.slice(0, 10) },
        })
      }
      const debugWording = [...c.footerLinks, ...c.navLinks].some((l) => looksLikeDebugWording(l.text))
      if (debugWording) {
        heuristicIssues.push({
          route: c.route,
          mode: c.mode,
          severity: 'low',
          code: 'PUBLIC_DEBUG_WORDING',
          message: 'Debug/internal wording detected in nav/footer link text.',
        })
      }
    }
  }

  for (const [title, arr] of titleMap.entries()) {
    if (arr.length <= 1) continue
    for (const a of arr) {
      heuristicIssues.push({
        route: a.route,
        mode: a.mode,
        severity: 'low',
        code: 'DUPLICATE_TITLE',
        message: `Duplicate page title: "${title}"`,
        details: { duplicates: arr.map((x) => x.route) },
      })
    }
  }

  const severityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const top10 = [...heuristicIssues].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]).slice(0, 10)

  // Write required outputs
  await writeJson(path.join(outDir, 'routes.json'), routes)
  await writeJson(path.join(outDir, 'console-errors.json'), consoleErrors)
  await writeJson(path.join(outDir, 'network-failures.json'), networkFailures)
  await writeJson(path.join(outDir, 'metadata.json'), captures)
  await writeJson(path.join(outDir, 'heuristics.json'), heuristicIssues)

  const summary = {
    baseUrl,
    scope,
    generatedAt: now.toISOString(),
    outputDir: path.relative(process.cwd(), outDir),
    totals: {
      routesAudited: captures.length,
      publicRoutesAudited: captures.filter((c) => c.mode === 'public').length,
      loggedInRoutesAudited: captures.filter((c) => c.mode === 'logged_in').length,
      ok: captures.filter((c) => c.ok).length,
      failed: captures.filter((c) => !c.ok).length,
      consoleErrors: consoleErrors.length,
      networkFailures: networkFailures.length,
      overflowX: captures.filter((c) => c.overflowX).length,
    },
    top10Issues: top10,
  }
  await writeJson(path.join(outDir, 'summary.json'), summary)

  // REPORT.md
  const lines: string[] = []
  lines.push(`# LeadIntel local audit report`)
  lines.push(``)
  lines.push(`1. Audit summary`)
  lines.push(`2. Public routes audited`)
  lines.push(`3. Logged-in routes audited`)
  lines.push(`4. High-priority issues`)
  lines.push(`5. Visual consistency observations`)
  lines.push(`6. Trust / pricing / CTA observations`)
  lines.push(`7. Console/network failures`)
  lines.push(`8. Mobile/responsive observations`)
  lines.push(`9. Route-by-route notes`)
  lines.push(`10. Artifact index`)
  lines.push(``)

  lines.push(`## 1) Audit summary`)
  lines.push(`- Base URL: \`${baseUrl}\``)
  lines.push(`- Scope: \`${scope}\``)
  lines.push(`- Generated: \`${now.toISOString()}\``)
  lines.push(`- Output folder: \`${summary.outputDir}\``)
  lines.push(`- Routes audited: **${summary.totals.routesAudited}** (ok: ${summary.totals.ok}, failed: ${summary.totals.failed})`)
  lines.push(``)

  lines.push(`## 2) Public routes audited`)
  for (const c of captures.filter((x) => x.mode === 'public')) lines.push(`- \`${c.route}\``)
  lines.push(``)

  lines.push(`## 3) Logged-in routes audited`)
  for (const c of captures.filter((x) => x.mode === 'logged_in')) lines.push(`- \`${c.route}\``)
  lines.push(``)

  lines.push(`## 4) High-priority issues (Top 10)`)
  if (top10.length === 0) {
    lines.push(`- None detected by heuristics.`)
  } else {
    for (const i of top10) {
      lines.push(`- **${i.severity.toUpperCase()}** \`${i.mode}:${i.route}\` — ${i.code}: ${i.message}`)
    }
  }
  lines.push(``)

  lines.push(`## 5) Visual consistency observations`)
  lines.push(`- Use \`screenshots/\` to evaluate spacing, hierarchy, and contrast across routes.`)
  lines.push(``)

  lines.push(`## 6) Trust / pricing / CTA observations`)
  lines.push(`- Review homepage + pricing CTAs via each route’s “Top CTAs” capture below.`)
  lines.push(`- Review trust posture via \`/trust\` and linked legal pages (if present).`)
  lines.push(``)

  lines.push(`## 7) Console/network failures`)
  lines.push(`- Console errors: **${summary.totals.consoleErrors}** (see \`console-errors.json\`)`)
  lines.push(`- Network failures: **${summary.totals.networkFailures}** (see \`network-failures.json\`)`)
  lines.push(``)

  lines.push(`## 8) Mobile/responsive observations`)
  const overflow = captures.filter((c) => c.overflowX).map((c) => `\`${c.route}\``)
  lines.push(`- Potential horizontal overflow routes: ${overflow.length ? overflow.join(', ') : 'none detected'}`)
  lines.push(``)

  lines.push(`## 9) Route-by-route notes`)
  for (const c of captures) {
    lines.push(`### \`${c.mode}:${c.route}\` — ${c.ok ? 'OK' : 'FAIL'}${c.status ? ` (HTTP ${c.status})` : ''}`)
    lines.push(`- Title: ${c.title ? `\`${c.title}\`` : '`(missing)`'}`)
    lines.push(`- H1: ${c.h1 ? `\`${c.h1}\`` : '`(missing)`'}`)
    lines.push(`- Headings: ${c.headings.length ? c.headings.map((h) => `\`${h}\``).join(', ') : '`(none)`'}`)
    lines.push(`- Meta description: ${c.metaDescription ? `\`${c.metaDescription}\`` : '`(missing)`'}`)
    lines.push(`- Canonical: ${c.canonical ? `\`${c.canonical}\`` : '`(missing)`'}`)
    lines.push(`- Top CTAs: ${c.topCtas.length ? c.topCtas.map((t) => `\`${t}\``).join(', ') : '`(none detected)`'}`)
    lines.push(
      `- Counts: consoleErrors=${c.consoleErrorCount}, failedRequests=${c.failedRequestCount}, http4xx5xx=${c.http4xx5xxCount}, overflowX=${c.overflowX}`
    )
    lines.push(`- Desktop screenshot: \`${path.relative(process.cwd(), c.screenshotDesktop)}\``)
    lines.push(`- Mobile screenshot: \`${path.relative(process.cwd(), c.screenshotMobile)}\``)
    lines.push(`- HTML snapshot: \`${path.relative(process.cwd(), c.htmlPath)}\``)
    lines.push(`- Events: \`${path.relative(process.cwd(), c.eventsPath)}\``)
    lines.push(``)
  }

  lines.push(`## 10) Artifact index`)
  lines.push(`- \`REPORT.md\`: this report`)
  lines.push(`- \`summary.json\`: totals + top 10 heuristic issues`)
  lines.push(`- \`routes.json\`: audited routes and discovery sources`)
  lines.push(`- \`metadata.json\`: per-route captures (H1, CTAs, links, etc.)`)
  lines.push(`- \`console-errors.json\`: consolidated console errors`)
  lines.push(`- \`network-failures.json\`: consolidated request failures + HTTP 4xx/5xx`)
  lines.push(`- \`heuristics.json\`: all heuristic flags`)
  lines.push(`- \`screenshots/\`: desktop/mobile screenshots`)
  lines.push(`- \`html/\`: HTML snapshots + per-route events`)

  await fs.writeFile(path.join(outDir, 'REPORT.md'), lines.join('\n') + '\n', 'utf8')

  // eslint-disable-next-line no-console
  console.log(`Audit complete. Output written to: ${outDir}`)
}

void main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[aiSiteAudit] failed', err)
  process.exitCode = 1
})

