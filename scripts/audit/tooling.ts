import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { chromium } from 'playwright'

export type AuditScope = 'public' | 'logged_in' | 'all'

export type DoctorLevel = 'PASS' | 'WARN' | 'FAIL'

export type DoctorCheck = {
  level: DoctorLevel
  name: string
  details?: string
  fix?: string
}

export function isWindows(): boolean {
  return process.platform === 'win32'
}

export function npmCommand(): string {
  return isWindows() ? 'npm.cmd' : 'npm'
}

export function npxCommand(): string {
  return isWindows() ? 'npx.cmd' : 'npx'
}

export function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name]
  if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  return fallback
}

export function readArg(name: string): string | null {
  const argv = process.argv.slice(2)
  const exact = argv.find((a) => a === name)
  if (exact) {
    const idx = argv.indexOf(exact)
    const next = argv[idx + 1]
    return typeof next === 'string' && !next.startsWith('--') ? next : ''
  }
  const pref = `${name}=`
  const hit = argv.find((a) => a.startsWith(pref))
  if (hit) return hit.slice(pref.length)
  return null
}

export function argOrEnv(argName: string, envName: string, fallback?: string): string | undefined {
  const v = readArg(argName)
  if (v !== null && v.trim().length > 0) return v.trim()
  return env(envName, fallback)
}

export function parseBaseUrl(raw: string): { ok: true; baseUrl: string } | { ok: false; error: string } {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, error: `Base URL must start with http:// or https:// (got ${u.protocol})` }
    }
    // Normalize (no trailing slash) so route joins are consistent.
    const normalized = `${u.origin}${u.pathname.replace(/\/+$/, '')}`
    return { ok: true, baseUrl: normalized }
  } catch {
    return { ok: false, error: `Base URL is not a valid URL: "${raw}"` }
  }
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export function formatPlatformExamples(): {
  publicAudit: string
  storageCapture: string
  fullAudit: string
} {
  const npm = npmCommand()
  const windows = isWindows()
  if (windows) {
    return {
      publicAudit: [
        '$env:AUDIT_BASE_URL = "https://dazrael.com"',
        '$env:AUDIT_SCOPE = "public"',
        `& "C:\\Program Files\\nodejs\\${npm}" run audit:ai`,
      ].join('\n'),
      storageCapture: [
        '$env:AUDIT_BASE_URL = "https://dazrael.com"',
        `& "C:\\Program Files\\nodejs\\${npm}" run audit:storage`,
      ].join('\n'),
      fullAudit: [
        '$env:AUDIT_BASE_URL = "https://dazrael.com"',
        '$env:AUDIT_SCOPE = "all"',
        '$env:AUDIT_STORAGE_STATE = "admin-reports/ai-site-audit/storageState.json"',
        `& "C:\\Program Files\\nodejs\\${npm}" run audit:ai`,
      ].join('\n'),
    }
  }

  return {
    publicAudit: ['AUDIT_BASE_URL="https://dazrael.com" AUDIT_SCOPE="public" npm run audit:ai'].join('\n'),
    storageCapture: ['AUDIT_BASE_URL="https://dazrael.com" npm run audit:storage'].join('\n'),
    fullAudit: [
      'AUDIT_BASE_URL="https://dazrael.com" AUDIT_SCOPE="all" AUDIT_STORAGE_STATE="admin-reports/ai-site-audit/storageState.json" npm run audit:ai',
    ].join('\n'),
  }
}

export function formatPlaywrightInstallHelp(): string {
  const npx = npxCommand()
  if (isWindows()) {
    return [
      'Playwright browser binaries are not installed yet.',
      '',
      'Fix (Windows PowerShell):',
      `  & "C:\\Program Files\\nodejs\\${npx}" playwright install chromium`,
      '',
      'Alternative:',
      `  & "C:\\Program Files\\nodejs\\${npx}" playwright install`,
    ].join('\n')
  }

  return [
    'Playwright browser binaries are not installed yet.',
    '',
    'Fix (macOS/Linux):',
    `  ${npx} playwright install chromium`,
    '',
    'Alternative:',
    `  ${npx} playwright install`,
  ].join('\n')
}

export async function preflightPlaywrightChromium(): Promise<{ ok: true } | { ok: false; message: string }> {
  // Playwright exposes the expected executable path even when not installed.
  const exe = chromium.executablePath()
  const exists = await pathExists(exe)
  if (!exists) {
    return {
      ok: false,
      message: [`[audit] Playwright Chromium not found at: ${exe}`, '', formatPlaywrightInstallHelp()].join('\n'),
    }
  }
  return { ok: true }
}

export async function preflightWritableDir(dir: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await fs.mkdir(dir, { recursive: true })
    const probe = path.join(dir, `.write-test-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`)
    await fs.writeFile(probe, 'ok', 'utf8')
    await fs.unlink(probe)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, message: `[audit] Cannot write to output directory: ${dir}\n${msg}` }
  }
}

export function detectLikelyPowerShell(): boolean {
  // Heuristic only: avoid being overly clever; used for a WARN in doctor.
  return typeof process.env.PSModulePath === 'string' && process.env.PSModulePath.length > 0
}

export function printDoctor(checks: DoctorCheck[]): void {
  const order: Record<DoctorLevel, number> = { FAIL: 0, WARN: 1, PASS: 2 }
  const sorted = [...checks].sort((a, b) => order[a.level] - order[b.level])

  // eslint-disable-next-line no-console
  console.log('=== audit:doctor ===')
  for (const c of sorted) {
    // eslint-disable-next-line no-console
    console.log(`${c.level}  ${c.name}${c.details ? ` — ${c.details}` : ''}`)
    if (c.fix) {
      // eslint-disable-next-line no-console
      console.log(`      Fix: ${c.fix}`)
    }
  }
  const hasFail = checks.some((c) => c.level === 'FAIL')
  const hasWarn = checks.some((c) => c.level === 'WARN')
  // eslint-disable-next-line no-console
  console.log('')
  // eslint-disable-next-line no-console
  console.log(`Result: ${hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS'}`)
}

