import { clientEnv, serverEnv } from '@/lib/env'
import { isTestLikeEnv } from '@/lib/runtimeFlags'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { Redis } from '@upstash/redis'

export type ComponentStatus = 'ok' | 'degraded' | 'down'

export type HealthComponent = {
  status: ComponentStatus
  message: string
}

export type HealthReport = {
  status: ComponentStatus
  components: {
    db: HealthComponent
    redis: HealthComponent
    supabaseApi: HealthComponent
    resend: HealthComponent
    openai: HealthComponent
    clearbit: HealthComponent
  }
}

function overallStatus(components: HealthReport['components']): ComponentStatus {
  const statuses = Object.values(components).map((c) => c.status)
  if (statuses.includes('down')) return 'down'
  if (statuses.includes('degraded')) return 'degraded'
  return 'ok'
}

function componentOk(message: string): HealthComponent {
  return { status: 'ok', message }
}
function componentDegraded(message: string): HealthComponent {
  return { status: 'degraded', message }
}
function componentDown(message: string): HealthComponent {
  return { status: 'down', message }
}

function shouldActiveCheckExternal(): boolean {
  if (serverEnv.NODE_ENV !== 'production') return true
  return serverEnv.HEALTH_CHECK_EXTERNAL === '1'
}

export async function checkDb(): Promise<HealthComponent> {
  // Avoid real network calls in unit/e2e by default.
  if (isTestLikeEnv()) return componentOk('skipped in test-like env')

  try {
    const supabaseAdmin = createSupabaseAdminClient()
    const { error } = await supabaseAdmin.from('users').select('id').limit(1)
    if (error) return componentDown('db query failed')
    return componentOk('ok')
  } catch {
    return componentDown('db unavailable')
  }
}

export async function checkSupabaseApi(): Promise<HealthComponent> {
  if (isTestLikeEnv()) return componentOk('skipped in test-like env')
  try {
    const url = `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1500)
    const res = await fetch(url, { method: 'GET', signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return componentDegraded(`supabase api returned ${res.status}`)
    return componentOk('ok')
  } catch {
    return componentDown('supabase api unreachable')
  }
}

export async function checkRedis(): Promise<HealthComponent> {
  if (isTestLikeEnv()) return componentOk('skipped in test-like env')
  try {
    // Redis.fromEnv throws if env missing
    const redis = Redis.fromEnv()
    // Use a read-only operation (no writes)
    await redis.get('@leadintel/health')
    return componentOk('ok')
  } catch {
    // In production, Redis is required for rate limiting; treat as down.
    return componentDown('redis unavailable')
  }
}

export async function checkResend(): Promise<HealthComponent> {
  const hasKey = Boolean(serverEnv.RESEND_API_KEY)
  if (!hasKey) return componentDegraded('not configured')
  if (!shouldActiveCheckExternal()) return componentOk('configured (not actively checked)')
  // Avoid calling provider endpoints; shallow check only.
  return componentOk('configured')
}

export async function checkOpenAI(): Promise<HealthComponent> {
  const hasKey = Boolean(serverEnv.OPENAI_API_KEY)
  if (!hasKey) return componentDegraded('not configured')
  if (!shouldActiveCheckExternal()) return componentOk('configured (not actively checked)')
  return componentOk('configured')
}

export async function checkClearbit(): Promise<HealthComponent> {
  const hasKey = Boolean(serverEnv.CLEARBIT_REVEAL_API_KEY || serverEnv.CLEARBIT_API_KEY)
  if (!hasKey) return componentDegraded('not configured')
  if (!shouldActiveCheckExternal()) return componentOk('configured (not actively checked)')
  return componentOk('configured')
}

export async function getHealthReport(): Promise<HealthReport> {
  const [db, redis, supabaseApi, resend, openai, clearbit] = await Promise.all([
    checkDb(),
    checkRedis(),
    checkSupabaseApi(),
    checkResend(),
    checkOpenAI(),
    checkClearbit(),
  ])

  const components = { db, redis, supabaseApi, resend, openai, clearbit }
  return {
    status: overallStatus(components),
    components,
  }
}

