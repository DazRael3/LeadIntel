export type LogLevel = 'info' | 'warn' | 'error'

export type LogEvent = {
  scope: string
  message: string
  level?: LogLevel
  correlationId?: string
  userId?: string
  leadId?: string
  errorCode?: string
  statusCode?: number
  details?: unknown // dev-only payload; never dumped in production
  [key: string]: unknown
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

function safeVal(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return null
}

function formatLine(e: LogEvent): string {
  const parts: string[] = []
  parts.push(`[${e.scope}] ${e.message}`)

  const add = (k: string, v: unknown) => {
    const s = safeVal(v)
    if (!s) return
    parts.push(`${k}=${s}`)
  }

  add('status', e.statusCode)
  add('code', e.errorCode)
  add('corr', e.correlationId)
  add('user', e.userId)
  add('lead', e.leadId)

  // Allow a few extra common fields without dumping huge objects.
  add('provider', (e as any).providerName)
  add('reason', (e as any).reason)
  add('company', (e as any).companyDomain ?? (e as any).companyName)

  return parts.join(' | ')
}

function emit(level: LogLevel, e: LogEvent): void {
  const line = formatLine(e)
  const details = e.details

  const method: 'log' | 'warn' | 'error' = level === 'info' ? 'log' : level
  console[method](line)

  // In dev only, optionally dump details as a second log entry.
  if (!isProd() && details !== undefined) {
    console[method]({ details })
  }
}

export function logInfo(event: LogEvent): void {
  emit(event.level ?? 'info', { ...event, level: event.level ?? 'info' })
}

export function logWarn(event: LogEvent): void {
  emit('warn', { ...event, level: 'warn' })
}

export function logError(event: LogEvent): void {
  emit('error', { ...event, level: 'error' })
}

export function createCorrelationId(scope: string, requestId?: string, userId?: string): string {
  const rid = (requestId ?? '').trim()
  const uid = (userId ?? '').trim()
  const base = rid ? `${scope}:${rid}` : `${scope}:${new Date().toISOString()}`
  return uid ? `${base}:${uid}` : `${base}:anon`
}

