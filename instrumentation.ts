/**
 * Next.js Instrumentation Hook
 *
 * This file is automatically loaded by Next.js for server-side initialization.
 * Initializes observability/logging on server startup.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initObservability } = await import('@/lib/observability/sentry')
    initObservability()
  }
}
