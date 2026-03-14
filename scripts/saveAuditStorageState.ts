import { chromium } from 'playwright'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'

function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name]
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  return fallback
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

async function main(): Promise<void> {
  const baseUrl = env('AUDIT_BASE_URL', 'http://localhost:3000')!
  const outDir = env('AUDIT_OUTPUT_DIR', path.join(process.cwd(), 'admin-reports', 'ai-site-audit'))!
  const outFile = env('AUDIT_STORAGE_STATE_OUT', path.join(outDir, 'storageState.json'))!

  await ensureDir(path.dirname(outFile))

  // eslint-disable-next-line no-console
  console.log(`[audit:storage] Opening browser for manual login...`)
  // eslint-disable-next-line no-console
  console.log(`[audit:storage] Base URL: ${baseUrl}`)
  // eslint-disable-next-line no-console
  console.log(`[audit:storage] Will save storageState to: ${outFile}`)
  // eslint-disable-next-line no-console
  console.log(`[audit:storage] IMPORTANT: Do not close the browser window until this script prints "Saved storageState".`)

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()

  // You will complete login manually in the opened browser window.
  await page.goto(new URL('/login?mode=signin&redirect=%2Fdashboard', baseUrl).toString(), { waitUntil: 'domcontentloaded' })
  // Wait until the session is live.
  // We accept ANY non-login route because some deployments redirect to onboarding or other start pages.
  await page.waitForFunction(
    () => {
      const p = window.location.pathname
      return !p.startsWith('/login') && !p.startsWith('/auth/')
    },
    undefined,
    { timeout: 5 * 60_000 }
  )

  await context.storageState({ path: outFile })
  await browser.close()

  // eslint-disable-next-line no-console
  console.log(`Saved storageState to: ${outFile}`)
}

void main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[saveAuditStorageState] failed', err)
  process.exitCode = 1
})

