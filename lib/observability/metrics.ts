import { captureBreadcrumb } from '@/lib/observability/sentry'
import { serverEnv } from '@/lib/env'

export type MetricsName =
  | 'autopilot.run.total'
  | 'autopilot.run.error'
  | 'webhook.resend.total'
  | 'webhook.resend.error'
  | 'webhook.resend.signature_invalid'
  | 'webhook.stripe.total'
  | 'webhook.stripe.error'
  | 'send_pitch.success'
  | 'send_pitch.error'
  | 'ratelimit.block'

type Tags = Record<string, string>

const MAX_TAG_VALUE_LEN = 120
const MAX_NAME_LEN = 120

function shouldDropKey(key: string): boolean {
  const k = key.toLowerCase()
  return (
    k.includes('authorization') ||
    k.includes('cookie') ||
    k.includes('token') ||
    k.includes('secret') ||
    k.includes('password') ||
    k.includes('api_key') ||
    k.includes('apikey') ||
    k.includes('html') ||
    k.includes('text') ||
    k.includes('body') ||
    k.includes('payload') ||
    k.includes('email')
  )
}

function sanitizeName(name: string): string {
  const n = name.trim()
  if (n.length <= MAX_NAME_LEN) return n
  return n.slice(0, MAX_NAME_LEN) + '…'
}

function sanitizeTags(tags?: Tags): Tags | undefined {
  if (!tags) return undefined
  const out: Tags = {}
  for (const [k, v] of Object.entries(tags)) {
    if (shouldDropKey(k)) continue
    const key = k.trim()
    if (!key) continue
    const value = String(v)
    out[key] = value.length > MAX_TAG_VALUE_LEN ? value.slice(0, MAX_TAG_VALUE_LEN) + '…' : value
  }
  return Object.keys(out).length ? out : undefined
}

function safeEmit(kind: 'counter' | 'timing', name: MetricsName, fields: Record<string, unknown>) {
  // Keep unit/e2e output quiet unless explicitly needed.
  if (serverEnv.NODE_ENV === 'test') return

  try {
    captureBreadcrumb({
      category: 'metrics',
      level: 'info',
      message: `${kind}:${sanitizeName(name)}`,
      data: fields,
    })
  } catch {
    // ignore
  }

  // If Sentry is disabled, breadcrumb call no-ops; emit structured console log for operators.
  try {
    if (!serverEnv.SENTRY_DSN) {
      // Never include sensitive tags/values; sanitized upstream.
      console.log('[metric]', { kind, name, ...fields })
    }
  } catch {
    // ignore
  }
}

export function recordCounter(name: MetricsName, value: number = 1, tags?: Tags): void {
  try {
    safeEmit('counter', name, { value, tags: sanitizeTags(tags) })
  } catch {
    // Never throw from metrics
  }
}

export function recordTiming(name: MetricsName, ms: number, tags?: Tags): void {
  try {
    safeEmit('timing', name, { ms, tags: sanitizeTags(tags) })
  } catch {
    // Never throw from metrics
  }
}

// Export sanitizers for unit tests (not part of public API, but stable enough for internal tests)
export const __test = { sanitizeTags, sanitizeName }

