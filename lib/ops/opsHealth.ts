import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getHealthReport, type HealthComponent } from '@/lib/services/health'

export type OpsHealthCheckStatus = 'ok' | 'warn' | 'error'

export type OpsHealthCheck = {
  key: string
  label: string
  status: OpsHealthCheckStatus
  weight: number
  message: string
}

export type OpsHealthGrade = 'excellent' | 'good' | 'needs_attention' | 'critical'

export type OpsHealthReport = {
  score: number
  grade: OpsHealthGrade
  updatedAt: string
  checks: OpsHealthCheck[]
}

function factorForStatus(s: OpsHealthCheckStatus): number {
  if (s === 'ok') return 1
  if (s === 'warn') return 0.5
  return 0
}

function gradeForScore(score: number): OpsHealthGrade {
  if (score >= 90) return 'excellent'
  if (score >= 75) return 'good'
  if (score >= 50) return 'needs_attention'
  return 'critical'
}

function canReadAdminTables(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  return url.length > 0 && serviceRole.length > 0
}

function componentToCheckFactor(c: HealthComponent): { status: OpsHealthCheckStatus; message: string } {
  if (c.status === 'ok') return { status: 'ok', message: c.message }
  if (c.status === 'down') return { status: 'error', message: c.message }
  if (c.status === 'degraded' || c.status === 'not_checked') return { status: 'warn', message: c.message }
  // not_enabled is fine for optional integrations, but app/auth/db are never not_enabled
  return { status: 'warn', message: c.message }
}

function hoursSince(iso: string, nowMs: number): number {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY
  return (nowMs - t) / (3600 * 1000)
}

function daysSince(iso: string, nowMs: number): number {
  return hoursSince(iso, nowMs) / 24
}

async function getLatestJobRun(jobName: string): Promise<{ status: string; finishedAt: string } | null> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data, error } = await admin
    .from('job_runs')
    .select('status, finished_at')
    .eq('job_name', jobName)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const status = typeof (data as any).status === 'string' ? (data as any).status : null
  const finishedAt = typeof (data as any).finished_at === 'string' ? (data as any).finished_at : null
  if (!status || !finishedAt) return null
  return { status, finishedAt }
}

export async function computeOpsHealth(): Promise<OpsHealthReport> {
  const updatedAt = new Date().toISOString()
  const checks: OpsHealthCheck[] = []

  // 1) Core health (weight 40 total across app/auth/db)
  const health = await getHealthReport()
  const app = componentToCheckFactor(health.components.app)
  const auth = componentToCheckFactor(health.components.auth)
  const db = componentToCheckFactor(health.components.db)

  const coreStatuses = [app.status, auth.status, db.status]
  const coreStatus: OpsHealthCheckStatus = coreStatuses.includes('error')
    ? 'error'
    : coreStatuses.includes('warn')
      ? 'warn'
      : 'ok'

  checks.push({
    key: 'core_health',
    label: 'Core health (app/auth/db)',
    status: coreStatus,
    weight: 40,
    message: `app=${app.status}, auth=${auth.status}, db=${db.status}`,
  })

  const nowMs = Date.now()

  // 2) Automation recency (weight 30 total)
  const recencyJobs: Array<{ job: string; label: string; weight: number; maxHours?: number; maxDays?: number }> = [
    { job: 'content_audit', label: 'content_audit recency', weight: 10, maxHours: 26 },
    { job: 'kpi_monitor', label: 'kpi_monitor recency', weight: 10, maxHours: 26 },
    { job: 'lifecycle', label: 'lifecycle recency', weight: 5, maxHours: 26 },
    { job: 'digest_lite', label: 'digest_lite recency', weight: 5, maxDays: 8 },
  ]

  const adminEnabled = canReadAdminTables()

  const jobRuns = adminEnabled
    ? await Promise.all(
        recencyJobs.map(async (j) => {
          try {
            const run = await getLatestJobRun(j.job)
            return [j.job, run] as const
          } catch {
            return [j.job, null] as const
          }
        })
      )
    : []
  const jobRunMap = new Map(jobRuns)

  for (const j of recencyJobs) {
    if (!adminEnabled) {
      checks.push({
        key: `automation_${j.job}`,
        label: j.label,
        status: 'warn',
        weight: j.weight,
        message: 'Automation metrics unavailable (missing Supabase service role configuration)',
      })
      continue
    }

    const run = jobRunMap.get(j.job) ?? null
    if (!run) {
      checks.push({
        key: `automation_${j.job}`,
        label: j.label,
        status: 'error',
        weight: j.weight,
        message: 'No completed run recorded',
      })
      continue
    }

    const ageOk =
      typeof j.maxHours === 'number'
        ? hoursSince(run.finishedAt, nowMs) <= j.maxHours
        : typeof j.maxDays === 'number'
          ? daysSince(run.finishedAt, nowMs) <= j.maxDays
          : true

    const ageWarn =
      typeof j.maxHours === 'number'
        ? hoursSince(run.finishedAt, nowMs) <= j.maxHours * 2
        : typeof j.maxDays === 'number'
          ? daysSince(run.finishedAt, nowMs) <= j.maxDays * 2
          : true

    const status: OpsHealthCheckStatus = ageOk ? 'ok' : ageWarn ? 'warn' : 'error'
    const msg = `lastFinishedAt=${run.finishedAt}, jobStatus=${run.status}`
    checks.push({ key: `automation_${j.job}`, label: j.label, status, weight: j.weight, message: msg })
  }

  // Remaining checks use DB (when enabled). Run them in parallel where possible.
  if (!adminEnabled) {
    checks.push({
      key: 'content_audit_status',
      label: 'Content audit status',
      status: 'warn',
      weight: 15,
      message: 'Content audit reports unavailable (missing Supabase service role configuration)',
    })
    checks.push({
      key: 'webhook_delivery_health',
      label: 'Webhook delivery health (24h)',
      status: 'warn',
      weight: 10,
      message: 'Webhook metrics unavailable (missing Supabase service role configuration)',
    })
    checks.push({
      key: 'exports_failures',
      label: 'Export failures (24h)',
      status: 'warn',
      weight: 5,
      message: 'Export metrics unavailable (missing Supabase service role configuration)',
    })
  } else {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const since24hIso = new Date(nowMs - 24 * 3600 * 1000).toISOString()

    const contentAuditPromise = (async (): Promise<OpsHealthCheck> => {
      try {
        const { data, error } = await admin
          .from('content_audit_reports')
          .select('status, failures, created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) throw error
        if (!data) {
          return { key: 'content_audit_status', label: 'Content audit status', status: 'warn', weight: 15, message: 'No content audit report recorded yet' }
        }
        const st = typeof (data as any).status === 'string' ? String((data as any).status) : 'error'
        const failures = (data as any).failures as unknown
        const failureCount = Array.isArray(failures) ? failures.length : 0
        const status: OpsHealthCheckStatus = st === 'ok' ? 'ok' : st === 'warn' ? 'warn' : 'error'
        return { key: 'content_audit_status', label: 'Content audit status', status, weight: 15, message: `status=${st}, failures=${failureCount}` }
      } catch {
        return { key: 'content_audit_status', label: 'Content audit status', status: 'warn', weight: 15, message: 'Failed to load latest content audit report' }
      }
    })()

    const webhooksPromise = (async (): Promise<OpsHealthCheck> => {
      try {
        const { data: endpoints, error: endpointsErr } = await admin.from('webhook_endpoints').select('id').limit(1)
        if (endpointsErr) throw endpointsErr
        const hasEndpoints = (endpoints ?? []).length > 0
        if (!hasEndpoints) {
          return { key: 'webhook_delivery_health', label: 'Webhook delivery health (24h)', status: 'ok', weight: 0, message: 'No webhook endpoints configured' }
        }

        const [{ count: total, error: totalErr }, { count: failed, error: failedErr }] = await Promise.all([
          admin
            .from('webhook_deliveries')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', since24hIso)
            .in('status', ['sent', 'failed']),
          admin.from('webhook_deliveries').select('id', { count: 'exact', head: true }).gte('created_at', since24hIso).eq('status', 'failed'),
        ])
        if (totalErr) throw totalErr
        if (failedErr) throw failedErr

        const tot = typeof total === 'number' ? total : 0
        const fail = typeof failed === 'number' ? failed : 0
        const rate = tot > 0 ? fail / tot : 0
        const status: OpsHealthCheckStatus = rate > 0.25 ? 'error' : rate > 0.1 ? 'warn' : 'ok'
        return {
          key: 'webhook_delivery_health',
          label: 'Webhook delivery health (24h)',
          status,
          weight: 10,
          message: tot === 0 ? 'No deliveries in last 24h' : `failed=${fail}, total=${tot}, failureRate=${Math.round(rate * 1000) / 10}%`,
        }
      } catch {
        return { key: 'webhook_delivery_health', label: 'Webhook delivery health (24h)', status: 'warn', weight: 10, message: 'Failed to compute webhook delivery health' }
      }
    })()

    const exportsPromise = (async (): Promise<OpsHealthCheck> => {
      try {
        const { data: anyJobs, error: anyJobsErr } = await admin.from('export_jobs').select('id').limit(1)
        if (anyJobsErr) throw anyJobsErr
        const hasExports = (anyJobs ?? []).length > 0
        if (!hasExports) {
          return { key: 'exports_failures', label: 'Export failures (24h)', status: 'ok', weight: 0, message: 'No exports recorded yet' }
        }

        const { count, error } = await admin
          .from('export_jobs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', since24hIso)
          .eq('status', 'failed')
        if (error) throw error
        const failed = typeof count === 'number' ? count : 0
        const status: OpsHealthCheckStatus = failed > 0 ? 'error' : 'ok'
        return { key: 'exports_failures', label: 'Export failures (24h)', status, weight: 5, message: failed > 0 ? `failedJobs=${failed}` : 'No failed exports in last 24h' }
      } catch {
        return { key: 'exports_failures', label: 'Export failures (24h)', status: 'warn', weight: 5, message: 'Failed to compute export failures' }
      }
    })()

    const [contentAuditCheck, webhookCheck, exportCheck] = await Promise.all([contentAuditPromise, webhooksPromise, exportsPromise])
    checks.push(contentAuditCheck, webhookCheck, exportCheck)
  }

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0)
  const weighted = checks.reduce((sum, c) => sum + c.weight * factorForStatus(c.status), 0)
  const score = totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) : 0

  return {
    score,
    grade: gradeForScore(score),
    updatedAt,
    checks,
  }
}

