/**
 * Generic Observability Shim
 *
 * Zero-dependency logging and error tracking wrapper.
 * Safe in all environments (server, edge, client, tests).
 * Extend this file to integrate any vendor (Sentry, LogRocket, etc.).
 */

/** Observability context for structured logging */
export type ObsContext = Record<string, unknown>

const PREFIX = '[obs]'

/** Check if running on server (Node.js or Edge) */
const isServer = typeof window === 'undefined'

/** Safely stringify context for logging */
function formatContext(ctx?: ObsContext): string {
  if (!ctx || Object.keys(ctx).length === 0) return ''
  try {
    return ' ' + JSON.stringify(ctx)
  } catch {
    return ' [context serialization failed]'
  }
}

/** Get error message from unknown error type */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/**
 * Initialize observability (called at app startup).
 * Extend here to init external SDKs.
 */
export function initObservability(): void {
  // No-op: extend to initialize vendor SDKs
}

/**
 * Capture and log an exception with optional context.
 * Never throws - safe to call anywhere.
 */
export function captureException(error: unknown, context?: ObsContext): void {
  try {
    const msg = getErrorMessage(error)
    const ctx = formatContext(context)
    if (isServer) {
      console.error(`${PREFIX} ERROR: ${msg}${ctx}`)
    } else if (typeof window !== 'undefined') {
      console.error(`${PREFIX} ERROR:`, msg, context ?? '')
    }
    // Extend here: send to external error tracking service
  } catch {
    // Never throw from observability helpers
  }
}

/**
 * Capture and log a message with optional context.
 * Never throws - safe to call anywhere.
 */
export function captureMessage(message: string, context?: ObsContext): void {
  try {
    const ctx = formatContext(context)
    if (isServer) {
      console.warn(`${PREFIX} ${message}${ctx}`)
    } else if (typeof window !== 'undefined') {
      console.warn(`${PREFIX}`, message, context ?? '')
    }
    // Extend here: send to external logging service
  } catch {
    // Never throw from observability helpers
  }
}

/**
 * Set request ID for correlation (legacy compatibility).
 * Extend here to set in vendor SDK scope.
 */
export function setRequestId(_requestId: string): void {
  // No-op: extend to set request ID in vendor SDK scope
}
