import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type DailySiteReportSummary = {
  signups: number
  trials_started: number
  active_users: number
  pitches_generated: number
  trigger_events_ingested: number
  watchlist_actions: number
}

export type DailySiteReport = {
  reportDate: Date
  summary: DailySiteReportSummary
  notes?: string
}

export type SiteReportRow = {
  id: string
  report_date: string // YYYY-MM-DD
  generated_at: string
  summary: DailySiteReportSummary
  notes: string | null
}

function iso(d: Date): string {
  return d.toISOString()
}

function toUtcDateString(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0))
}

async function countInWindow(params: {
  table: string
  timeColumn: string
  sinceIso: string
  untilIso: string
  extra?: (q: any) => any
}): Promise<number> {
  const client = createSupabaseAdminClient()
  try {
    let q = client
      .from(params.table)
      .select('id', { count: 'exact', head: true })
      .gte(params.timeColumn, params.sinceIso)
      .lt(params.timeColumn, params.untilIso)
    if (params.extra) q = params.extra(q)
    const { count, error } = await q
    if (error) return 0
    return typeof count === 'number' ? count : 0
  } catch {
    return 0
  }
}

async function distinctUserIdsInWindow(params: {
  table: string
  userIdColumn: string
  timeColumn: string
  sinceIso: string
  untilIso: string
  extra?: (q: any) => any
}): Promise<Set<string>> {
  const client = createSupabaseAdminClient()
  const out = new Set<string>()
  try {
    let q = client
      .from(params.table)
      .select(params.userIdColumn)
      .gte(params.timeColumn, params.sinceIso)
      .lt(params.timeColumn, params.untilIso)
      .limit(5000)
    if (params.extra) q = params.extra(q)
    const { data, error } = await q
    if (error) return out
    const rows = (data ?? []) as Array<Record<string, unknown>>
    for (const r of rows) {
      const v = r[params.userIdColumn]
      if (typeof v === 'string' && v.length > 0) out.add(v)
    }
    return out
  } catch {
    return out
  }
}

export async function generateDailySiteReport(now: Date = new Date()): Promise<DailySiteReport> {
  const until = now
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const sinceIso = iso(since)
  const untilIso = iso(until)

  const reportDate = startOfUtcDay(now)

  // Note: counts are best-effort; failures should not block report generation.
  const signups = await countInWindow({
    table: 'users',
    timeColumn: 'created_at',
    sinceIso,
    untilIso,
  })

  const trials_started = await countInWindow({
    table: 'users',
    timeColumn: 'trial_starts_at',
    sinceIso,
    untilIso,
    extra: (q) => q.not('trial_starts_at', 'is', null),
  })

  const pitches_generated = await countInWindow({
    table: 'pitches',
    timeColumn: 'created_at',
    sinceIso,
    untilIso,
  })

  const trigger_events_ingested = await countInWindow({
    table: 'trigger_events',
    timeColumn: 'created_at',
    sinceIso,
    untilIso,
  })

  const watchlist_actions = await countInWindow({
    table: 'product_analytics',
    timeColumn: 'created_at',
    sinceIso,
    untilIso,
    extra: (q) => q.like('event_name', 'watchlist_%'),
  })

  const activeUserIds = new Set<string>()
  const fromPitches = await distinctUserIdsInWindow({
    table: 'pitches',
    userIdColumn: 'user_id',
    timeColumn: 'created_at',
    sinceIso,
    untilIso,
  })
  for (const id of fromPitches) activeUserIds.add(id)

  // Product analytics includes both server and (minimal) client events.
  const fromAnalytics = await distinctUserIdsInWindow({
    table: 'product_analytics',
    userIdColumn: 'user_id',
    timeColumn: 'created_at',
    sinceIso,
    untilIso,
    extra: (q) => q.not('user_id', 'is', null),
  })
  for (const id of fromAnalytics) activeUserIds.add(id)

  const summary: DailySiteReportSummary = {
    signups,
    trials_started,
    active_users: activeUserIds.size,
    pitches_generated,
    trigger_events_ingested,
    watchlist_actions,
  }

  return {
    reportDate,
    summary,
    notes: `Auto-generated daily report at ${untilIso} UTC`,
  }
}

export async function upsertDailySiteReport(params: DailySiteReport): Promise<SiteReportRow> {
  const client = createSupabaseAdminClient()
  const reportDate = toUtcDateString(params.reportDate)
  const generatedAt = new Date().toISOString()

  const { data, error } = await client
    .from('site_reports')
    .upsert(
      {
        report_date: reportDate,
        generated_at: generatedAt,
        summary: params.summary,
        notes: params.notes ?? null,
      },
      { onConflict: 'report_date' }
    )
    .select('id, report_date, generated_at, summary, notes')
    .single()

  if (error || !data) {
    throw new Error(`Failed to upsert site report: ${error?.message ?? 'unknown error'}`)
  }

  return data as SiteReportRow
}

export async function runDailySiteReport(now?: Date): Promise<SiteReportRow> {
  const report = await generateDailySiteReport(now ?? new Date())
  return await upsertDailySiteReport(report)
}

