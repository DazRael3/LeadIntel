import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, createCookieBridge } from '@/lib/api/http'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { JobName } from '@/lib/jobs/types'

export const dynamic = 'force-dynamic'

type AutomationLastRun = {
  status: string
  finishedAt: string
}

const JOBS = ['lifecycle', 'digest_lite', 'kpi_monitor', 'content_audit', 'growth_cycle', 'sources_refresh'] as const satisfies readonly JobName[]

function canReadJobRuns(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  return url.length > 0 && serviceRole.length > 0
}

export const GET = withApiGuard(async (_request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()

  if (!canReadJobRuns()) {
    return ok({ enabled: false, lastRuns: {} }, undefined, bridge, requestId)
  }

  try {
    const supabase = createSupabaseAdminClient({ schema: 'api' })

    const entries = await Promise.all(
      JOBS.map(async (job) => {
        const { data, error } = await supabase
          .from('job_runs')
          .select('status, finished_at')
          .eq('job_name', job)
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(1)
        if (error) throw error
        const row = data?.[0] as { status?: unknown; finished_at?: unknown } | undefined
        const status = typeof row?.status === 'string' ? row.status : null
        const finishedAt = typeof row?.finished_at === 'string' ? row.finished_at : null
        if (!status || !finishedAt) return null
        return [job, { status, finishedAt } satisfies AutomationLastRun] as const
      })
    )

    const lastRuns: Record<string, AutomationLastRun> = {}
    for (const e of entries) {
      if (!e) continue
      lastRuns[e[0]] = e[1]
    }

    return ok({ enabled: true, lastRuns }, undefined, bridge, requestId)
  } catch {
    return ok({ enabled: false, lastRuns: {} }, undefined, bridge, requestId)
  }
})

