/**
 * Central structured logger for server logs.
 *
 * This keeps logs consistent and safe for aggregation:
 * - Always emits a single JSON string per log call.
 * - In production, avoids dumping large objects or stack traces.
 */

export const IS_DEV = process.env.NODE_ENV !== 'production'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogEventBase = {
  scope: string
  message: string
  correlationId?: string
} & Record<string, unknown>

export type LogEvent = LogEventBase & {
  level?: LogLevel
}

function sanitizeForProd(value: unknown): unknown {
  // Never serialize full Error objects in production (they include stack traces).
  if (value instanceof Error) return String(value)
  return value
}

function buildPayload(event: LogEvent): Record<string, unknown> {
  const { level: rawLevel, ...rest } = event
  const level: LogLevel = rawLevel ?? 'info'

  const payload: Record<string, unknown> = { level, ...rest }

  if (!IS_DEV) {
    for (const [k, v] of Object.entries(payload)) {
      if (k === 'error' || k === 'err') {
        payload[k] = String(v)
      } else {
        payload[k] = sanitizeForProd(v)
      }
    }
  }

  return payload
}

export function log(event: LogEvent): void {
  const payload = buildPayload(event)
  const level = (payload.level as LogLevel | undefined) ?? 'info'
  const json = IS_DEV ? JSON.stringify(payload, null, 2) : JSON.stringify(payload)

  if (level === 'warn') return void console.warn(json)
  if (level === 'error') return void console.error(json)
  return void console.log(json)
}

export function logInfo(event: LogEventBase): void {
  log({ ...event, level: 'info' })
}

export function logWarn(event: LogEventBase): void {
  log({ ...event, level: 'warn' })
}

export function logError(event: LogEventBase): void {
  log({ ...event, level: 'error' })
}

