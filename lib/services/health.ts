import { isTestLikeEnv } from '@/lib/runtimeFlags'
import { runEnvDoctor } from '@/lib/ops/envDoctor'

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
  const env = runEnvDoctor()
  const posthog = env.subsystems.find((s) => s.key === 'posthog')
  components.posthog = posthog?.configured ? ok('configured') : notEnabled('not configured')
  components.sentry = hasEnv('SENTRY_DSN') ? ok('configured') : notEnabled('not configured')

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

