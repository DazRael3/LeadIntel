import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type RunHealthWindow = '24h' | '7d'

export type RunHealthSummary = {
  window: RunHealthWindow
  sinceIso: string
  usageEvents: { pitchComplete: number; reportComplete: number; reservationsCancelled: number }
  exports: { pending: number; ready: number; failed: number }
  webhooks: { pending: number; sent: number; failed: number; retryBacklogDue: number }
  jobs: Array<{ jobName: string; ok: number; error: number; skipped: number }>
}

function sinceIsoForWindow(window: RunHealthWindow): string {
  const now = Date.now()
  const ms = window === '24h' ? 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000
  return new Date(now - ms).toISOString()
}

export async function computeRunHealth(window: RunHealthWindow): Promise<RunHealthSummary> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const sinceIso = sinceIsoForWindow(window)
  const nowIso = new Date().toISOString()

  const [
    pitchCompleteRes,
    reportCompleteRes,
    cancelledRes,
    exportsPendingRes,
    exportsReadyRes,
    exportsFailedRes,
    webhooksPendingRes,
    webhooksSentRes,
    webhooksFailedRes,
    webhooksDueRes,
    jobRunsRes,
  ] = await Promise.all([
    admin.from('usage_events').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso).eq('status', 'complete').eq('object_type', 'pitch'),
    admin.from('usage_events').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso).eq('status', 'complete').eq('object_type', 'report'),
    admin.from('usage_events').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso).eq('status', 'cancelled'),
    admin.from('export_jobs').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso).eq('status', 'pending'),
    admin.from('export_jobs').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso).eq('status', 'ready'),
    admin.from('export_jobs').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso).eq('status', 'failed'),
    admin.from('webhook_deliveries').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso).eq('status', 'pending'),
    admin.from('webhook_deliveries').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso).eq('status', 'sent'),
    admin.from('webhook_deliveries').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso).eq('status', 'failed'),
    admin.from('webhook_deliveries').select('id', { count: 'exact', head: true }).eq('status', 'pending').lte('next_attempt_at', nowIso),
    admin.from('job_runs').select('job_name, status').gte('started_at', sinceIso).limit(2000),
  ])

  const jobsMap = new Map<string, { ok: number; error: number; skipped: number }>()
  const jobRows = (jobRunsRes.data ?? []) as Array<{ job_name?: unknown; status?: unknown }>
  for (const r of jobRows) {
    const jobName = typeof r.job_name === 'string' ? r.job_name : null
    const status = typeof r.status === 'string' ? r.status : null
    if (!jobName || !status) continue
    const entry = jobsMap.get(jobName) ?? { ok: 0, error: 0, skipped: 0 }
    if (status === 'ok') entry.ok++
    else if (status === 'error') entry.error++
    else entry.skipped++
    jobsMap.set(jobName, entry)
  }

  return {
    window,
    sinceIso,
    usageEvents: {
      pitchComplete: typeof pitchCompleteRes.count === 'number' ? pitchCompleteRes.count : 0,
      reportComplete: typeof reportCompleteRes.count === 'number' ? reportCompleteRes.count : 0,
      reservationsCancelled: typeof cancelledRes.count === 'number' ? cancelledRes.count : 0,
    },
    exports: {
      pending: typeof exportsPendingRes.count === 'number' ? exportsPendingRes.count : 0,
      ready: typeof exportsReadyRes.count === 'number' ? exportsReadyRes.count : 0,
      failed: typeof exportsFailedRes.count === 'number' ? exportsFailedRes.count : 0,
    },
    webhooks: {
      pending: typeof webhooksPendingRes.count === 'number' ? webhooksPendingRes.count : 0,
      sent: typeof webhooksSentRes.count === 'number' ? webhooksSentRes.count : 0,
      failed: typeof webhooksFailedRes.count === 'number' ? webhooksFailedRes.count : 0,
      retryBacklogDue: typeof webhooksDueRes.count === 'number' ? webhooksDueRes.count : 0,
    },
    jobs: Array.from(jobsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([jobName, v]) => ({ jobName, ok: v.ok, error: v.error, skipped: v.skipped })),
  }
}

