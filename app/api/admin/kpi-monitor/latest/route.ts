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

type SnapshotRow = {
  run_started_at: string | null
  run_finished_at: string | null
  metric: string
  window: '24h' | '7d'
  current: number
  previous: number
  drop_pct: number
  alert: boolean
  note: string | null
  reason: string | null
}

function safeNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const token = readAdminToken(request)
    if (!isValidAdminToken(token)) {
      return fail(ErrorCode.NOT_FOUND, 'Not found', undefined, { status: 404 }, bridge, requestId)
    }

    const admin = createSupabaseAdminClient({ schema: 'api' })

    // Prefer job_runs for status/reason, then attach snapshot rows for the latest snapshot run.
    const { data: jobRun } = await admin
      .from('job_runs')
      .select('status, started_at, finished_at, summary')
      .eq('job_name', 'kpi_monitor')
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Find latest run_finished_at from snapshots.
    const { data: latest, error: latestErr } = await admin
      .from('kpi_monitor_snapshots')
      .select('run_started_at, run_finished_at, reason, created_at')
      .not('run_finished_at', 'is', null)
      .order('run_finished_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestErr) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to load KPI monitor snapshots', { message: latestErr.message }, undefined, bridge, requestId)
    }

    if (!latest?.run_finished_at) {
      return ok({ latestRun: null, rows: [] }, undefined, bridge, requestId)
    }

    const runFinishedAt = String(latest.run_finished_at)
    const runStartedAt = latest.run_started_at ? String(latest.run_started_at) : null

    const { data: rowsRaw, error: rowsErr } = await admin
      .from('kpi_monitor_snapshots')
      .select('run_started_at, run_finished_at, metric, time_window, current, previous, drop_pct, alert, note, reason')
      .eq('run_finished_at', runFinishedAt)
      .order('metric', { ascending: true })
      .order('time_window', { ascending: true })

    if (rowsErr) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to load KPI monitor rows', { message: rowsErr.message }, undefined, bridge, requestId)
    }

    const rows: SnapshotRow[] = (rowsRaw ?? []).map((r: unknown) => {
      const rr = r as Record<string, unknown>
      return {
        run_started_at: typeof rr.run_started_at === 'string' ? rr.run_started_at : null,
        run_finished_at: typeof rr.run_finished_at === 'string' ? rr.run_finished_at : null,
        metric: String(rr.metric ?? ''),
        window: (rr.time_window === '24h' || rr.time_window === '7d' ? rr.time_window : '24h') as '24h' | '7d',
        current: safeNum(rr.current),
        previous: safeNum(rr.previous),
        drop_pct: safeNum(rr.drop_pct),
        alert: Boolean(rr.alert),
        note: typeof rr.note === 'string' ? rr.note : null,
        reason: typeof rr.reason === 'string' ? rr.reason : null,
      }
    })

    const actionableAlerts = rows.filter((r) => r.alert).length
    const insufficientRows = rows.filter((r) => typeof r.note === 'string' && r.note.startsWith('insufficient_')).length
    const snapReason = rows.find((r) => typeof r.reason === 'string' && r.reason.length > 0)?.reason ?? latest.reason ?? null
    const jobSummary = (jobRun?.summary ?? null) as unknown
    const jobReason =
      jobSummary && typeof jobSummary === 'object' && 'reason' in (jobSummary as Record<string, unknown>)
        ? (jobSummary as Record<string, unknown>).reason
        : null
    const reason = typeof jobReason === 'string' ? jobReason : snapReason

    const status = typeof jobRun?.status === 'string' ? jobRun.status : 'ok'
    const startedAt = typeof jobRun?.started_at === 'string' ? jobRun.started_at : runStartedAt
    const finishedAt = typeof jobRun?.finished_at === 'string' ? jobRun.finished_at : runFinishedAt

    return ok(
      {
        latestRun: {
          startedAt,
          finishedAt,
          status,
          reason,
          alerts: actionableAlerts,
          actionableAlerts,
          insufficientRows,
        },
        rows,
      },
      undefined,
      bridge,
      requestId
    )
  } catch (err) {
    return asHttpError(err, '/api/admin/kpi-monitor/latest', undefined, bridge, requestId)
  }
})

