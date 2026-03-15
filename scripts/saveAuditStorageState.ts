import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { chromium } from 'playwright'
import {
  argOrEnv,
  parseBaseUrl,
  preflightPlaywrightChromium,
  preflightWritableDir,
  formatPlatformExamples,
  npmCommand,
} from './audit/tooling'

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

async function main(): Promise<void> {
  const rawBaseUrl = argOrEnv('--baseUrl', 'AUDIT_BASE_URL')
  const examples = formatPlatformExamples()
  if (!rawBaseUrl) {
    // eslint-disable-next-line no-console
    console.error('[audit:storage] Missing AUDIT_BASE_URL (or --baseUrl).')
    // eslint-disable-next-line no-console
    console.error('')
    // eslint-disable-next-line no-console
    console.error('[audit:storage] Example commands:')
    // eslint-disable-next-line no-console
    console.error(examples.storageCapture)
    // eslint-disable-next-line no-console
    console.error('')
    // eslint-disable-next-line no-console
    console.error(`[audit:storage] Note: On Windows PowerShell, "${npmCommand()}" is often safer than "npm" if npm.ps1 is blocked.`)
    process.exitCode = 1
    return
  }

  const parsed = parseBaseUrl(rawBaseUrl)
  if (!parsed.ok) {
    // eslint-disable-next-line no-console
    console.error(`[audit:storage] ${parsed.error}`)
    // eslint-disable-next-line no-console
    console.error('')
    // eslint-disable-next-line no-console
    console.error('[audit:storage] Example commands:')
    // eslint-disable-next-line no-console
    console.error(examples.storageCapture)
    process.exitCode = 1
    return
  }
  const baseUrl = parsed.baseUrl
  const outDir = argOrEnv('--outputDir', 'AUDIT_OUTPUT_DIR', path.join(process.cwd(), 'admin-reports', 'ai-site-audit'))!
  const outFile = argOrEnv('--outFile', 'AUDIT_STORAGE_STATE_OUT', path.join(outDir, 'storageState.json'))!

  await ensureDir(path.dirname(outFile))

  const pw = await preflightPlaywrightChromium()
  if (!pw.ok) {
    // eslint-disable-next-line no-console
    console.error(pw.message)
    process.exitCode = 1
    return
  }

  const writable = await preflightWritableDir(path.dirname(outFile))
  if (!writable.ok) {
    // eslint-disable-next-line no-console
    console.error(writable.message)
    process.exitCode = 1
    return
  }

  // eslint-disable-next-line no-console
  console.log(`[audit:storage] Opening browser for manual login...`)
  // eslint-disable-next-line no-console
  console.log(`[audit:storage] Base URL: ${baseUrl}`)
  // eslint-disable-next-line no-console
  console.log(`[audit:storage] Will save storageState to: ${outFile}`)
  // eslint-disable-next-line no-console
  console.log(`[audit:storage] IMPORTANT: Do not close the browser window until this script prints "Saved storageState".`)
  // eslint-disable-next-line no-console
  console.log(`[audit:storage] After login, you may land on onboarding or another start page — that's OK.`)

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
  // eslint-disable-next-line no-console
  console.log(`[audit:storage] Next: run the audit with AUDIT_STORAGE_STATE set to this file.`)
}

void main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[saveAuditStorageState] failed', err)
  process.exitCode = 1
})

