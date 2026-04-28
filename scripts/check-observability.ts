import { getPosthogConfiguration } from '@/lib/observability/posthog-config'
import { getSentryConfiguration } from '@/lib/observability/sentry-config'
import { getPublicVersionInfo } from '@/lib/debug/buildInfo'
import { getAutomationJobConfig, hasAnyCronSecret } from '@/lib/observability/automation-config'

type CheckStatus = 'pass' | 'fail' | 'warn'

type CheckResult = {
  status: CheckStatus
  name: string
  detail: string
}

function push(results: CheckResult[], status: CheckStatus, name: string, detail: string): void {
  results.push({ status, name, detail })
}

export function runChecks(): CheckResult[] {
  const results: CheckResult[] = []
  const openAiKey = (process.env.OPENAI_API_KEY ?? '').trim()
  const sentryAuthToken = (process.env.SENTRY_AUTH_TOKEN ?? '').trim()

  const posthog = getPosthogConfiguration()
  if (posthog.mode === 'misconfigured') {
    push(results, 'fail', 'posthog', posthog.messages.join(' '))
  } else if (posthog.mode === 'disabled') {
    push(results, 'warn', 'posthog', 'PostHog is disabled.')
  } else if (posthog.mode === 'capture_only') {
    push(results, 'pass', 'posthog', 'Analytics capture configured (public token + host).')
  } else if (posthog.mode === 'private_api') {
    push(results, 'pass', 'posthog', 'PostHog private API configured.')
  } else {
    push(results, 'pass', 'posthog', 'PostHog capture + private API configured.')
  }

  const sentry = getSentryConfiguration()
  if (sentry.mode === 'misconfigured') {
    push(results, 'fail', 'sentry', sentry.messages.join(' '))
  } else if (sentry.mode === 'disabled') {
    push(results, 'warn', 'sentry', 'Sentry DSN is not configured; error reporting disabled.')
  } else {
    push(results, 'pass', 'sentry', `Sentry configured (${sentry.effectiveDsnSource} DSN).`)
  }

  const version = getPublicVersionInfo()
  if (version.metadataComplete) {
    push(results, 'pass', 'version-metadata', 'Version metadata complete.')
  } else {
    push(results, 'warn', 'version-metadata', 'Version metadata incomplete, using safe null fallbacks.')
  }

  const enabledJobs = getAutomationJobConfig({ hasEnabledWebhookEndpoints: false }).filter((job) => job.enabled)
  if (enabledJobs.length > 0 && !hasAnyCronSecret()) {
    push(results, 'fail', 'health-automation', 'Automation is enabled but no cron auth secrets are configured.')
  } else if (enabledJobs.length > 0) {
    push(results, 'pass', 'health-automation', 'Automation jobs enabled with cron auth configured.')
  } else {
    push(results, 'warn', 'health-automation', 'Automation jobs disabled by feature flags.')
  }

  const serialized = JSON.stringify({ posthog, sentry, version })
  if ((openAiKey && serialized.includes(openAiKey)) || (sentryAuthToken && serialized.includes(sentryAuthToken))) {
    push(results, 'fail', 'secret-leak-check', 'Observable diagnostics output includes raw secret values.')
  } else {
    push(results, 'pass', 'secret-leak-check', 'No raw secret values detected in diagnostics output.')
  }

  return results
}

export function printReport(results: CheckResult[]): void {
  console.log('Observability Diagnostics')
  console.log('-------------------------')
  for (const result of results) {
    const icon = result.status === 'pass' ? 'PASS' : result.status === 'warn' ? 'WARN' : 'FAIL'
    console.log(`[${icon}] ${result.name}: ${result.detail}`)
  }
}

export function main(): void {
  const results = runChecks()
  printReport(results)
  const failed = results.some((result) => result.status === 'fail')
  if (failed) process.exit(1)
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
