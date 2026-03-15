import * as path from 'node:path'
import {
  argOrEnv,
  detectLikelyPowerShell,
  formatPlaywrightInstallHelp,
  npmCommand,
  parseBaseUrl,
  pathExists,
  preflightPlaywrightChromium,
  preflightWritableDir,
  printDoctor,
  type DoctorCheck,
} from './audit/tooling'

function nodeMajor(): number {
  const m = /^(\d+)\./.exec(process.versions.node)
  return m ? Number.parseInt(m[1] ?? '0', 10) : 0
}

async function main(): Promise<void> {
  const checks: DoctorCheck[] = []

  const major = nodeMajor()
  if (major >= 20 && major < 23) {
    checks.push({ level: 'PASS', name: 'Node.js version', details: process.versions.node })
  } else {
    checks.push({
      level: 'FAIL',
      name: 'Node.js version',
      details: process.versions.node,
      fix: 'Install Node 20 or 22 (repo engines: >=20 <23).',
    })
  }

  const nodeModules = path.join(process.cwd(), 'node_modules')
  checks.push(
    (await pathExists(nodeModules))
      ? { level: 'PASS', name: 'Dependencies installed', details: 'node_modules present' }
      : { level: 'FAIL', name: 'Dependencies installed', details: 'node_modules missing', fix: `${npmCommand()} ci` }
  )

  const scriptsOk =
    (await pathExists(path.join(process.cwd(), 'scripts', 'aiSiteAudit.ts'))) &&
    (await pathExists(path.join(process.cwd(), 'scripts', 'saveAuditStorageState.ts')))
  checks.push(
    scriptsOk
      ? { level: 'PASS', name: 'Audit scripts present' }
      : { level: 'FAIL', name: 'Audit scripts present', fix: 'Ensure you are in the repo root and have pulled latest changes.' }
  )

  const pw = await preflightPlaywrightChromium()
  checks.push(
    pw.ok
      ? { level: 'PASS', name: 'Playwright Chromium installed' }
      : { level: 'FAIL', name: 'Playwright Chromium installed', details: 'missing browser binaries', fix: formatPlaywrightInstallHelp() }
  )

  const outRoot = argOrEnv('--outputDir', 'AUDIT_OUTPUT_DIR', path.join(process.cwd(), 'admin-reports', 'ai-site-audit'))!
  const writable = await preflightWritableDir(outRoot)
  checks.push(
    writable.ok
      ? { level: 'PASS', name: 'Output directory writable', details: outRoot }
      : { level: 'FAIL', name: 'Output directory writable', details: outRoot, fix: 'Choose a different AUDIT_OUTPUT_DIR or fix filesystem permissions.' }
  )

  const rawBaseUrl = argOrEnv('--baseUrl', 'AUDIT_BASE_URL')
  if (!rawBaseUrl) {
    checks.push({
      level: 'WARN',
      name: 'AUDIT_BASE_URL set',
      details: 'not set',
      fix: 'Set AUDIT_BASE_URL (or pass --baseUrl) before running audit commands.',
    })
  } else {
    const parsed = parseBaseUrl(rawBaseUrl)
    checks.push(
      parsed.ok
        ? { level: 'PASS', name: 'AUDIT_BASE_URL valid', details: parsed.baseUrl }
        : { level: 'FAIL', name: 'AUDIT_BASE_URL valid', details: rawBaseUrl, fix: parsed.error }
    )
  }

  const scope = (argOrEnv('--scope', 'AUDIT_SCOPE', 'all') ?? 'all').trim()
  const storage = argOrEnv('--storageState', 'AUDIT_STORAGE_STATE')
  const needsStorage = scope === 'logged_in' || scope === 'all'
  if (needsStorage) {
    if (!storage) {
      checks.push({
        level: 'WARN',
        name: 'Storage state for logged-in audit',
        details: 'AUDIT_STORAGE_STATE not set',
        fix: 'Run audit:storage first, then set AUDIT_STORAGE_STATE to admin-reports/ai-site-audit/storageState.json',
      })
    } else {
      checks.push(
        (await pathExists(storage))
          ? { level: 'PASS', name: 'Storage state file exists', details: storage }
          : {
              level: 'FAIL',
              name: 'Storage state file exists',
              details: storage,
              fix: 'Run audit:storage to generate storageState.json, or correct AUDIT_STORAGE_STATE path.',
            }
      )
    }
  } else {
    checks.push({ level: 'PASS', name: 'Storage state not required', details: `scope=${scope}` })
  }

  if (detectLikelyPowerShell()) {
    checks.push({
      level: 'WARN',
      name: 'PowerShell detected',
      details: 'If npm.ps1 is blocked, use npm.cmd / npx.cmd',
      fix: `Use: & "C:\\Program Files\\nodejs\\${npmCommand()}" run audit:doctor`,
    })
  }

  printDoctor(checks)

  if (checks.some((c) => c.level === 'FAIL')) {
    process.exitCode = 1
  }
}

void main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[audit:doctor] failed', err)
  process.exitCode = 1
})

