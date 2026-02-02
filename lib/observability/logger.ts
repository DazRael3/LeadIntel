/**
 * Central structured logger for server-side observability.
 *
 * Re-exported wrapper around the shared logger implementation so call-sites
 * can consistently import from `lib/observability/logger`.
 */

export { IS_DEV, log, logInfo, logWarn, logError } from '@/lib/logging/logger'

