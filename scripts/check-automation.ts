import fs from 'node:fs'
import path from 'node:path'
import { getAutomationJobConfig, hasAnyCronSecret } from '@/lib/observability/automation-config'

type CheckStatus = 'pass' | 'fail' | 'warn'

type CheckResult = {
  status: CheckStatus
  name: string
  detail: string
}

type VercelCron = {
  path?: string
  schedule?: string
}

const ROOT = process.cwd()
const VERCEL_JSON = path.join(ROOT, 'vercel.json')

function trimEnv(name: string): string {
  return (process.env[name] ?? '').trim()
}

function readVercelCrons(): VercelCron[] {
  if (!fs.existsSync(VERCEL_JSON)) return []
  try {
    const raw = fs.readFileSync(VERCEL_JSON, 'utf8')
    const parsed = JSON.parse(raw) as { crons?: VercelCron[] }
    return parsed.crons ?? []
  } catch {
    return []
  }
}

function parseJobFromPath(rawPath: string): string | null {
  try {
    const url = new URL(rawPath, 'https://raelinfo.com')
    if (!url.pathname.startsWith('/api/')) return null
    return url.searchParams.get('job')
  } catch {
    return null
  }
}

function isSafeCronPath(rawPath: string): boolean {
  try {
    const url = new URL(rawPath, 'https://raelinfo.com')
    return url.pathname.startsWith('/api/') && !url.pathname.includes('..')
  } catch {
    return false
  }
}

function push(results: CheckResult[], status: CheckStatus, name: string, detail: string): void {
  results.push({ status, name, detail })
}

export function runChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const vercelCrons = readVercelCrons()
  const jobs = getAutomationJobConfig({ hasEnabledWebhookEndpoints: false })
  const enabledJobs = jobs.filter((job) => job.enabled)
  const requiredJobs = jobs.filter((job) => job.enabled && job.required)
  const vercelJobs = new Set(
    vercelCrons
      .filter((cron) => typeof cron.path === 'string' && isSafeCronPath(cron.path))
      .map((cron) => parseJobFromPath(cron.path as string))
      .filter((job): job is string => Boolean(job))
  )

  const cronSecretConfigured = hasAnyCronSecret()
  const cronEnvVars = [
    'CRON_SECRET',
    'EXTERNAL_CRON_SECRET',
    'DIGEST_CRON_SECRET',
    'ACTIONS_QUEUE_CRON_SECRET',
    'SITE_REPORT_CRON_SECRET',
  ] as const
  for (const name of cronEnvVars) {
    const present = trimEnv(name).length > 0
    push(results, present ? 'pass' : 'warn', `env:${name}`, present ? 'configured' : 'missing')
  }
  push(
    results,
    cronSecretConfigured ? 'pass' : requiredJobs.length > 0 ? 'fail' : 'warn',
    'cron-secrets',
    cronSecretConfigured
      ? 'Cron auth secret(s) configured.'
      : requiredJobs.length > 0
        ? 'Required automation jobs require CRON_SECRET/EXTERNAL_CRON_SECRET (or app-specific cron secret).'
        : 'No cron secrets configured, but automation jobs are disabled.'
  )

  const siteReportsEnabled = trimEnv('ENABLE_SITE_REPORTS').toLowerCase() === '1' || trimEnv('ENABLE_SITE_REPORTS').toLowerCase() === 'true'
  const siteReportSecret = trimEnv('SITE_REPORT_CRON_SECRET')
  if (siteReportsEnabled && !siteReportSecret) {
    push(results, 'fail', 'site-reports-secret', 'ENABLE_SITE_REPORTS is true but SITE_REPORT_CRON_SECRET is missing.')
  } else if (siteReportsEnabled) {
    push(results, 'pass', 'site-reports-secret', 'Site reports are enabled and cron secret is configured.')
  } else {
    push(results, 'warn', 'site-reports-secret', 'Site reports disabled.')
  }

  const invalidCronPaths = vercelCrons.filter((cron) => typeof cron.path === 'string' && !isSafeCronPath(cron.path))
  if (invalidCronPaths.length > 0) {
    push(results, 'fail', 'vercel-cron-targets', 'One or more vercel.json cron paths are invalid or unsafe.')
  } else {
    push(results, 'pass', 'vercel-cron-targets', 'Cron route targets in vercel.json are safe.')
  }

  for (const job of requiredJobs) {
    if (job.wiring === 'vercel_cron') {
      if (vercelJobs.has(job.job)) {
        push(results, 'pass', `job:${job.job}`, 'Required Vercel cron job is scheduled.')
      } else {
        push(results, 'fail', `job:${job.job}`, 'Required Vercel cron job is not scheduled in vercel.json.')
      }
    } else if (!cronSecretConfigured) {
      push(results, 'fail', `job:${job.job}`, 'Required external scheduler job lacks cron auth secret configuration.')
    } else {
      push(results, 'warn', `job:${job.job}`, 'Required external scheduler job must be configured outside vercel.json.')
    }
  }

  const disabledJobs = jobs.filter((job) => !job.enabled)
  if (disabledJobs.length > 0) {
    push(
      results,
      'warn',
      'disabled-jobs',
      `Disabled jobs: ${disabledJobs.map((job) => job.job).join(', ')}`
    )
  }

  return results
}

export function printReport(results: CheckResult[]): void {
  console.log('Automation Diagnostics')
  console.log('----------------------')
  for (const result of results) {
    const icon = result.status === 'pass' ? 'PASS' : result.status === 'warn' ? 'WARN' : 'FAIL'
    console.log(`[${icon}] ${result.name}: ${result.detail}`)
  }
}

export function main(): void {
  const results = runChecks()
  printReport(results)
  const hasFailures = results.some((result) => {
    if (result.status !== 'fail') return false
    return result.name.startsWith('job:') || result.name === 'site-reports-secret'
  })
  if (hasFailures) process.exit(1)
}

const directRunArg = process.argv[1]
if (directRunArg) {
  try {
    const directRunUrl = new URL(`file://${directRunArg}`).href
    if (import.meta.url === directRunUrl) {
      main()
    }
  } catch {
    // noop
  }
}
