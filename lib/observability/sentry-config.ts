import fs from 'node:fs'
import path from 'node:path'

type SentryMode = 'disabled' | 'enabled' | 'misconfigured'

export type SentryConfiguration = {
  mode: SentryMode
  sdkInstalled: boolean
  hasServerDsn: boolean
  hasPublicDsn: boolean
  effectiveDsnSource: 'server' | 'public' | 'none'
  environment: string | null
  tracesSampleRate: number | null
  replaysSessionSampleRate: number | null
  replaysOnErrorSampleRate: number | null
  messages: string[]
}

function trimEnv(name: string): string {
  return (process.env[name] ?? '').trim()
}

let cachedSdkInstalled: boolean | null = null

function detectSentrySdkInstalled(): boolean {
  const override = trimEnv('SENTRY_SDK_INSTALLED').toLowerCase()
  if (override === '1' || override === 'true') {
    cachedSdkInstalled = true
    return cachedSdkInstalled
  }
  if (override === '0' || override === 'false') {
    cachedSdkInstalled = false
    return cachedSdkInstalled
  }
  if (cachedSdkInstalled !== null) return cachedSdkInstalled
  try {
    const pkgPath = path.join(process.cwd(), 'package.json')
    const raw = fs.readFileSync(pkgPath, 'utf8')
    const parsed = JSON.parse(raw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    cachedSdkInstalled = Boolean(
      parsed.dependencies?.['@sentry/nextjs'] || parsed.devDependencies?.['@sentry/nextjs']
    )
    return cachedSdkInstalled
  } catch {
    cachedSdkInstalled = false
    return cachedSdkInstalled
  }
}

function parseSampleRate(name: string, messages: string[]): number | null {
  const raw = trimEnv(name)
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    messages.push(`${name} must be a number between 0 and 1.`)
    return null
  }
  return value
}

function isValidSentryDsn(value: string): boolean {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      parsed.hostname.length > 0 &&
      /\/[0-9]+$/.test(parsed.pathname)
    )
  } catch {
    return false
  }
}

export function getSentryConfiguration(): SentryConfiguration {
  const serverDsn = trimEnv('SENTRY_DSN')
  const publicDsn = trimEnv('NEXT_PUBLIC_SENTRY_DSN')
  const sdkInstalled = detectSentrySdkInstalled()
  const messages: string[] = []

  if (serverDsn && !isValidSentryDsn(serverDsn)) {
    messages.push('SENTRY_DSN is not a valid Sentry DSN URL.')
  }
  if (publicDsn && !isValidSentryDsn(publicDsn)) {
    messages.push('NEXT_PUBLIC_SENTRY_DSN is not a valid Sentry DSN URL.')
  }

  const hasServerDsn = Boolean(serverDsn && isValidSentryDsn(serverDsn))
  const hasPublicDsn = Boolean(publicDsn && isValidSentryDsn(publicDsn))
  const effectiveDsnSource: SentryConfiguration['effectiveDsnSource'] = hasServerDsn
    ? 'server'
    : hasPublicDsn
      ? 'public'
      : 'none'

  const tracesSampleRate = parseSampleRate('SENTRY_TRACES_SAMPLE_RATE', messages)
  const replaysSessionSampleRate = parseSampleRate('SENTRY_REPLAYS_SESSION_SAMPLE_RATE', messages)
  const replaysOnErrorSampleRate = parseSampleRate('SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE', messages)

  if ((hasServerDsn || hasPublicDsn) && !sdkInstalled) {
    messages.push(
      'Sentry DSN is set but @sentry/nextjs is not installed. Install with: npm install @sentry/nextjs && npx @sentry/wizard@latest -i nextjs'
    )
  }

  const mode: SentryMode =
    messages.length > 0 ? 'misconfigured' : effectiveDsnSource === 'none' ? 'disabled' : 'enabled'

  return {
    mode,
    sdkInstalled,
    hasServerDsn,
    hasPublicDsn,
    effectiveDsnSource,
    environment: trimEnv('SENTRY_ENVIRONMENT') || null,
    tracesSampleRate,
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
    messages,
  }
}
