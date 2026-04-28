import { isTestLikeEnv } from '@/lib/runtimeFlags'
import { getPosthogConfiguration } from '@/lib/observability/posthog-config'
import { getSentryConfiguration } from '@/lib/observability/sentry-config'
import { getAutomationJobConfig, hasAnyCronSecret } from '@/lib/observability/automation-config'
import { getPublicVersionInfo } from '@/lib/debug/buildInfo'

export type ServiceStatus = 'operational' | 'degraded' | 'down'
export type ComponentStatus = 'ok' | 'degraded' | 'down' | 'not_enabled' | 'not_checked'

export type HealthComponent = {
  status: ComponentStatus
  message: string
  meta?: Record<string, unknown>
}

export type HealthReport = {
  status: ServiceStatus
  checkedAt: string
  components: Record<string, HealthComponent>
}

function nowIso(): string {
  return new Date().toISOString()
}

function ok(message: string, meta?: Record<string, unknown>): HealthComponent {
  return { status: 'ok', message, ...(meta ? { meta } : {}) }
}
function degraded(message: string, meta?: Record<string, unknown>): HealthComponent {
  return { status: 'degraded', message, ...(meta ? { meta } : {}) }
}
function down(message: string, meta?: Record<string, unknown>): HealthComponent {
  return { status: 'down', message, ...(meta ? { meta } : {}) }
}
function notEnabled(message: string): HealthComponent {
  return { status: 'not_enabled', message }
}
function notChecked(message: string): HealthComponent {
  return { status: 'not_checked', message }
}

function hasEnv(name: string): boolean {
  return typeof process.env[name] === 'string' && process.env[name]!.trim().length > 0
}

function computeOverallStatus(critical: HealthComponent[]): ServiceStatus {
  if (critical.some((c) => c.status === 'down')) return 'down'
  if (critical.some((c) => c.status === 'degraded' || c.status === 'not_checked')) return 'degraded'
  return 'operational'
}

function summarizePosthogComponent(): HealthComponent {
  const cfg = getPosthogConfiguration()
  if (cfg.mode === 'misconfigured') {
    return degraded(cfg.messages.join(' '), {
      analyticsEnabled: cfg.analyticsEnabled,
      analyticsCaptureConfigured: cfg.analyticsCaptureConfigured,
      privateApiConfigured: cfg.privateApiConfigured,
    })
  }
  if (cfg.mode === 'capture_and_private_api') {
    return ok('analytics capture + private API configured')
  }
  if (cfg.mode === 'private_api') {
    return ok('private API configured')
  }
  if (cfg.mode === 'capture_only') {
    return ok('analytics capture configured')
  }
  return notEnabled('not configured')
}

function summarizeSentryComponent(): HealthComponent {
  const cfg = getSentryConfiguration()
  if (cfg.mode === 'misconfigured') {
    return degraded(cfg.messages.join(' '))
  }
  if (cfg.mode === 'enabled') {
    return ok('configured', {
      dsnSource: cfg.effectiveDsnSource,
      environment: cfg.environment,
    })
  }
  return notEnabled('not configured')
}

function summarizeAutomationComponent(): HealthComponent {
  const jobs = getAutomationJobConfig({ hasEnabledWebhookEndpoints: false })
  const enabledJobs = jobs.filter((job) => job.enabled)
  if (enabledJobs.length === 0) {
    return notEnabled('automation disabled by feature flags')
  }
  const missingCronSecret = !hasAnyCronSecret()
  if (missingCronSecret) {
    return degraded('enabled automation jobs require cron secrets', {
      enabledJobs: enabledJobs.map((job) => job.job),
    })
  }
  return ok('configured', {
    enabledJobs: enabledJobs.map((job) => job.job),
  })
}

function summarizeVersionComponent(): HealthComponent {
  const version = getPublicVersionInfo()
  if (version.metadataComplete) {
    return ok('build metadata available', {
      repo: version.repo,
      branch: version.branch,
      commitShort: version.commitShort,
    })
  }
  return degraded('build metadata incomplete', {
    repo: version.repo,
    branch: version.branch,
    commitShort: version.commitShort,
  })
}

async function checkSupabaseAuth(): Promise<HealthComponent> {
  if (isTestLikeEnv()) return ok('skipped in test-like env')
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !anon) return notChecked('Supabase env not present on server')

  const endpoint = `${url.replace(/\/$/, '')}/auth/v1/health`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        apikey: anon,
      },
    })
    clearTimeout(timeout)

    if (res.status === 401 || res.status === 403) {
      return degraded('Supabase auth health returned 401/403 (check ANON key)', { status: res.status })
    }
    if (!res.ok) {
      return degraded(`Supabase auth health returned ${res.status}`, { status: res.status })
    }

    const text = await res.text().catch(() => '')
    let meta: Record<string, unknown> | undefined = undefined
    try {
      meta = text ? (JSON.parse(text) as Record<string, unknown>) : undefined
    } catch {
      meta = undefined
    }

    return ok('ok', meta)
  } catch {
    return down('Supabase auth health unreachable')
  }
}

async function checkSupabaseDb(): Promise<HealthComponent> {
  if (isTestLikeEnv()) return ok('skipped in test-like env')
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !anon) return notChecked('Supabase env not present on server')

  // Lightweight DB ping (no table dependency).
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/rpc/health_ping`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    clearTimeout(timeout)

    if (res.status === 401 || res.status === 403) {
      return degraded('Supabase DB ping returned 401/403 (check ANON key)', { status: res.status })
    }
    if (!res.ok) {
      return degraded(`Supabase DB ping returned ${res.status}`, { status: res.status })
    }

    const text = await res.text().catch(() => '')
    let meta: Record<string, unknown> | undefined = { status: res.status }
    try {
      const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : undefined
      if (parsed && typeof parsed === 'object') meta = { ...meta, ...parsed }
    } catch {
      // ignore
    }

    if (meta && meta.ok === true) return ok('ok', meta)
    return ok('ok', meta)
  } catch {
    return down('Supabase DB ping unreachable')
  }
}

function checkOptionalConfig(): Record<string, HealthComponent> {
  const components: Record<string, HealthComponent> = {}

  // Redis (Upstash) - optional for this status report (not all deployments require it).
  const redisUrl = (process.env.UPSTASH_REDIS_REST_URL ?? '').trim()
  const redisToken = (process.env.UPSTASH_REDIS_REST_TOKEN ?? '').trim()
  components.redis =
    /^https?:\/\//.test(redisUrl) && redisToken.length > 0 ? ok('configured') : notEnabled('not configured')

  components.resend = hasEnv('RESEND_API_KEY') ? ok('configured') : notEnabled('not configured')
  components.openai = hasEnv('OPENAI_API_KEY') ? ok('configured') : notEnabled('not configured')
  components.clearbit =
    hasEnv('CLEARBIT_REVEAL_API_KEY') || hasEnv('CLEARBIT_API_KEY') ? ok('configured') : notEnabled('not configured')
  components.posthog = summarizePosthogComponent()
  components.sentry = summarizeSentryComponent()
  components.automation = summarizeAutomationComponent()
  components.version = summarizeVersionComponent()

  return components
}

export async function getHealthReport(): Promise<HealthReport> {
  const checkedAt = nowIso()

  const [auth, db] = await Promise.all([checkSupabaseAuth(), checkSupabaseDb()])
  const app = ok('ok')
  const optional = checkOptionalConfig()

  const components: Record<string, HealthComponent> = {
    app,
    auth,
    db,
    ...optional,
  }

  const status = computeOverallStatus([app, auth, db])

  return { status, checkedAt, components }
}

