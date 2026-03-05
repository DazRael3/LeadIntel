/**
 * Observability facade.
 *
 * Sentry was intentionally removed to reduce attack surface and eliminate
 * bundler/transitive dependency risk. The app keeps a stable facade API so
 * call sites can safely report errors without coupling to a vendor SDK.
 */

/** Observability context for structured logging */
export type ObsContext = Record<string, unknown>

type Breadcrumb = {
  category?: string
  message?: string
  level?: 'debug' | 'info' | 'warning' | 'error'
  data?: ObsContext
}

export function initObservability(): void {
  // no-op (Sentry removed)
}

export function captureException(_error: unknown, _context?: ObsContext): void {
  // no-op (Sentry removed)
}

export function captureMessage(_message: string, _context?: ObsContext): void {
  // no-op (Sentry removed)
}

export function captureBreadcrumb(_breadcrumb: Breadcrumb): void {
  // no-op (Sentry removed)
}

export function setRequestId(_requestId: string): void {
  // no-op (Sentry removed)
}
