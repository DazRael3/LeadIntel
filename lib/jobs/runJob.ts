import type { JobName, JobResult, TriggeredBy } from '@/lib/jobs/types'
import { persistJobRun } from '@/lib/jobs/persist'
import { runLifecycleEmails } from '@/lib/jobs/lifecycle'
import { runDigestLiteSend } from '@/lib/jobs/digestLite'
import { runKpiMonitor } from '@/lib/jobs/kpiMonitor'
import { runContentAudit } from '@/lib/jobs/contentAudit'

export async function runJob(
  job: JobName,
  opts: { dryRun?: boolean; triggeredBy: TriggeredBy; limit?: number }
): Promise<JobResult> {
  const startedAt = new Date().toISOString()
  let status: JobResult['status'] = 'ok'
  let summary: Record<string, unknown> = {}
  let errorText: string | null = null

  try {
    const dryRun = Boolean(opts.dryRun)
    if (job === 'lifecycle') {
      const res = await runLifecycleEmails({ dryRun, limit: opts.limit })
      status = res.status
      summary = res.summary as Record<string, unknown>
    } else if (job === 'digest_lite') {
      const res = await runDigestLiteSend({ dryRun })
      status = res.status
      summary = res.summary as Record<string, unknown>
    } else if (job === 'kpi_monitor') {
      const res = await runKpiMonitor({ dryRun })
      status = res.status
      summary = res.summary as Record<string, unknown>
    } else if (job === 'content_audit') {
      const res = await runContentAudit({ dryRun })
      status = res.status
      summary = res.summary as Record<string, unknown>
    } else {
      status = 'skipped'
      summary = { reason: 'unknown_job' }
    }
  } catch (e) {
    status = 'error'
    errorText = e instanceof Error ? e.message : 'unknown_error'
    summary = { error: errorText }
  }

  const finishedAt = new Date().toISOString()
  const result: JobResult = { job, status, summary, startedAt, finishedAt }

  // Persist best-effort (service-role only). Never fail the job for persistence.
  void persistJobRun({
    job,
    triggeredBy: opts.triggeredBy,
    status,
    startedAt,
    finishedAt,
    summary,
    errorText,
  })

  return result
}

