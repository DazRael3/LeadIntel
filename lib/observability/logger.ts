/**
 * Central structured logger for server-side observability.
 *
 * Re-exported wrapper around the shared logger implementation so call-sites
 * can consistently import from `lib/observability/logger`.
 */

export { IS_DEV, log, logInfo, logWarn, logError } from '@/lib/logging/logger'

/**
 * Compatibility facade: `logger.info|warn|error(...)`.
 *
 * Prefer `logInfo/logWarn/logError` in new code, but some routes expect a logger object.
 */
import { logInfo, logWarn, logError } from '@/lib/logging/logger'

export const logger = {
  info: logInfo,
  warn: logWarn,
  error: logError,
}

