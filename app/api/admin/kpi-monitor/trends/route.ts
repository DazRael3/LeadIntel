import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function readAdminToken(request: NextRequest): string | null {
  const header = (request.headers.get('x-admin-token') ?? '').trim()
  if (header) return header
  const url = new URL(request.url)
  const q = (url.searchParams.get('token') ?? '').trim()
  return q || null
}

function isValidAdminToken(provided: string | null): boolean {
  const expected = (process.env.ADMIN_TOKEN ?? '').trim()
  if (!expected) return false
  return Boolean(provided) && provided === expected
}

function clampDays(v: string | null): number {
  const n = v ? Number(v) : 14
  const d = Number.isFinite(n) ? Math.floor(n) : 14
  return Math.max(1, Math.min(30, d))
}

function isoDateKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function safeNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

type TrendPoint = {
  date: string
  metric: string
  window: '24h' | '7d'
  current: number
}

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const token = readAdminToken(request)
    if (!isValidAdminToken(token)) {
      return fail(ErrorCode.NOT_FOUND, 'Not found', undefined, { status: 404 }, bridge, requestId)
    }

    const url = new URL(request.url)
    const days = clampDays(url.searchParams.get('days'))

    const end = new Date()
    const start = new Date(end.getTime() - (days - 1) * 24 * 3600 * 1000)
    // Query by created_at; we take the latest snapshot for each (metric,window,date).
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { data, error } = await admin
      .from('kpi_monitor_snapshots')
      .select('created_at, metric, window, current')
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: true })
      .limit(5000)

    if (error) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to load KPI trends', { message: error.message }, undefined, bridge, requestId)
    }

    // Keep latest per day/metric/window by comparing created_at.
    const latestByKey = new Map<string, { createdAt: string; point: TrendPoint }>()
    for (const row of data ?? []) {
      const r = row as Record<string, unknown>
      const createdAt = typeof r.created_at === 'string' ? r.created_at : null
      const metric = typeof r.metric === 'string' ? r.metric : null
      const window = r.window === '24h' || r.window === '7d' ? (r.window as '24h' | '7d') : null
      if (!createdAt || !metric || !window) continue

      const date = isoDateKey(new Date(createdAt))
      const key = `${date}|${metric}|${window}`
      const current = safeNum(r.current)
      const point: TrendPoint = { date, metric, window, current }

      const existing = latestByKey.get(key)
      if (!existing || createdAt > existing.createdAt) {
        latestByKey.set(key, { createdAt, point })
      }
    }

    // Emit points sorted by date then metric/window for stable UI.
    const points = Array.from(latestByKey.values())
      .map((v) => v.point)
      .sort((a, b) => (a.date === b.date ? (a.metric === b.metric ? a.window.localeCompare(b.window) : a.metric.localeCompare(b.metric)) : a.date.localeCompare(b.date)))

    return ok({ days, points }, undefined, bridge, requestId)
  } catch (err) {
    return asHttpError(err, '/api/admin/kpi-monitor/trends', undefined, bridge, requestId)
  }
})

