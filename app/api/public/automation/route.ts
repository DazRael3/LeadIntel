import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, createCookieBridge } from '@/lib/api/http'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { JobName } from '@/lib/jobs/types'

export const dynamic = 'force-dynamic'

type AutomationSummary = {
  monitoredJobs: number
  recentSuccess: boolean
  stale: boolean
}

const JOBS = ['lifecycle', 'digest_lite', 'kpi_monitor', 'content_audit', 'growth_cycle', 'sources_refresh'] as const satisfies readonly JobName[]

const JOB_STALE_HOURS: Record<JobName, number> = {
  lifecycle: 30,
  digest_lite: 8 * 24,
  kpi_monitor: 30,
  content_audit: 30,
  growth_cycle: 30,
  sources_refresh: 30,
  autopilot: 30,
  leads_discover: 30,
  digest: 30,
  digest_content: 30,
  email_send: 30,
  prospect_watch: 30,
  prospect_watch_digest: 8 * 24,
  webhook_queue_drain: 30,
}

function canReadJobRuns(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  return url.length > 0 && serviceRole.length > 0
}

function summaryFallback(): AutomationSummary {
  return {
    monitoredJobs: JOBS.length,
    recentSuccess: false,
    stale: true,
  }
}

export const GET = withApiGuard(async (_request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()

  if (!canReadJobRuns()) {
    return ok({ enabled: false, summary: summaryFallback() }, undefined, bridge, requestId)
  }

  try {
    const supabase = createSupabaseAdminClient({ schema: 'api' })
    const nowMs = Date.now()

    const checks = await Promise.all(
      JOBS.map(async (job) => {
        const { data, error } = await supabase
          .from('job_runs')
          .select('status, finished_at')
          .eq('job_name', job)
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error || !data) return { hasRun: false, success: false, stale: true }

        const status = typeof data.status === 'string' ? data.status : ''
        const finishedAt = typeof data.finished_at === 'string' ? Date.parse(data.finished_at) : Number.NaN
        const maxAgeHours = JOB_STALE_HOURS[job] ?? 30
        const stale = !Number.isFinite(finishedAt) || (nowMs - finishedAt) / (1000 * 60 * 60) > maxAgeHours
        return {
          hasRun: true,
          success: status === 'ok',
          stale,
        }
      })
    )

    const recentSuccess = checks.every((c) => c.hasRun && c.success)
    const stale = checks.some((c) => c.stale)
    return ok(
      {
        enabled: true,
        summary: {
          monitoredJobs: JOBS.length,
          recentSuccess,
          stale,
        },
      },
      undefined,
      bridge,
      requestId
    )
  } catch {
    return ok({ enabled: false, summary: summaryFallback() }, undefined, bridge, requestId)
  }
})

