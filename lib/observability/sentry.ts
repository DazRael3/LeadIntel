/**
 * Observability facade (Sentry-backed when configured).
 *
 * Goals:
 * - Keep a stable facade API for call sites.
 * - Use Sentry when SENTRY_DSN is configured.
 * - Safe no-op when not configured (dev/test/e2e).
 * - Never log/attach secrets, tokens, or full email bodies.
 */

import { serverEnv } from '@/lib/env'

/** Observability context for structured logging */
export type ObsContext = Record<string, unknown>

// Local minimal type to avoid depending on optional Sentry type packages at build time.
type ScopeContext = Record<string, unknown>

type Breadcrumb = {
  category?: string
  message?: string
  level?: 'debug' | 'info' | 'warning' | 'error'
  data?: ObsContext
}

let sentryInitialized = false

function isSentryEnabled(): boolean {
  return Boolean(serverEnv.SENTRY_DSN)
}

function safeString(value: unknown, maxLen: number = 200): string | undefined {
  if (typeof value === 'string') return value.length > maxLen ? value.slice(0, maxLen) + '…' : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

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
    k.includes('openai') ||
    k.includes('stripe') ||
    k.includes('resend') ||
    k.includes('html') ||
    k.includes('text') ||
    k.includes('body') ||
    k.includes('payload')
  )
}

function sanitizeContext(ctx?: ObsContext): ObsContext | undefined {
  if (!ctx) return undefined
  const out: ObsContext = {}
  for (const [k, v] of Object.entries(ctx)) {
    if (shouldDropKey(k)) continue
    const s = safeString(v, 300)
    if (s !== undefined) {
      out[k] = s
      continue
    }
    // Allow small nested objects only if they stringify cheaply; otherwise drop.
    if (v && typeof v === 'object') {
      try {
        const str = JSON.stringify(v)
        if (str.length <= 500) out[k] = v
      } catch {
        // ignore
      }
    }
  }
  return Object.keys(out).length ? out : undefined
}

async function getSentry() {
  // Lazy import so dev/test without dependency can still run.
  const mod = await import('@sentry/nextjs')
  return mod
}

/**
 * Initialize Sentry (called from `instrumentation.ts` on Node runtime).
 * Safe to call multiple times.
 */
export function initObservability(): void {
  try {
    if (sentryInitialized) return
    if (!isSentryEnabled()) return
    sentryInitialized = true
    void (async () => {
      try {
        const Sentry = await getSentry()
        Sentry.init({
          dsn: serverEnv.SENTRY_DSN,
          environment: serverEnv.SENTRY_ENVIRONMENT || serverEnv.NODE_ENV,
          // Keep default sampling conservative; adjust in infra when needed.
          tracesSampleRate: 0,
          sendDefaultPii: false,
        })
      } catch {
        // Never throw from init; keep app running.
      }
    })()
  } catch {
    // Never throw
  }
}

/**
 * Capture exception (Sentry if configured, otherwise no-op).
 */
export function captureException(error: unknown, context?: ObsContext): void {
  try {
    if (!isSentryEnabled()) return
    void (async () => {
      try {
        const Sentry = await getSentry()
        const extra = sanitizeContext(context)
        Sentry.withScope((scope) => {
          if (extra) scope.setContext('ctx', extra as ScopeContext)
          // Never attach raw error-like objects as extra; just capture.
          Sentry.captureException(error)
        })
      } catch {
        // ignore
      }
    })()
  } catch {
    // ignore
  }
}

/**
 * Capture message (Sentry if configured, otherwise no-op).
 */
export function captureMessage(message: string, context?: ObsContext): void {
  try {
    if (!isSentryEnabled()) return
    void (async () => {
      try {
        const Sentry = await getSentry()
        const extra = sanitizeContext(context)
        Sentry.withScope((scope) => {
          if (extra) scope.setContext('ctx', extra as ScopeContext)
          Sentry.captureMessage(message)
        })
      } catch {
        // ignore
      }
    })()
  } catch {
    // ignore
  }
}

export function captureBreadcrumb(breadcrumb: Breadcrumb): void {
  try {
    if (!isSentryEnabled()) return
    void (async () => {
      try {
        const Sentry = await getSentry()
        Sentry.addBreadcrumb({
          category: breadcrumb.category,
          message: breadcrumb.message,
          level: breadcrumb.level,
          data: sanitizeContext(breadcrumb.data),
        })
      } catch {
        // ignore
      }
    })()
  } catch {
    // ignore
  }
}

/**
 * Set request ID for correlation.
 */
export function setRequestId(requestId: string): void {
  try {
    if (!isSentryEnabled()) return
    void (async () => {
      try {
        const Sentry = await getSentry()
        Sentry.setTag('request_id', safeString(requestId, 100) || requestId)
      } catch {
        // ignore
      }
    })()
  } catch {
    // ignore
  }
}
