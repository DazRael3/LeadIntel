import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { JobResult, TriggeredBy } from '@/lib/jobs/types'

export async function persistJobRun(args: {
  job: JobResult['job']
  triggeredBy: TriggeredBy
  status: JobResult['status']
  startedAt: string
  finishedAt: string
  summary: Record<string, unknown>
  errorText?: string | null
}): Promise<{ enabled: boolean }> {
  try {
    const supabase = createSupabaseAdminClient({ schema: 'api' })
    await supabase.from('job_runs').insert({
      job_name: args.job,
      triggered_by: args.triggeredBy,
      status: args.status,
      started_at: args.startedAt,
      finished_at: args.finishedAt,
      summary: args.summary,
      error_text: args.errorText ?? null,
    })
    return { enabled: true }
  } catch {
    return { enabled: false }
  }
}

export async function readLatestJobRuns(limit = 20): Promise<{ enabled: boolean; runs: Array<Record<string, unknown>> }> {
  try {
    const supabase = createSupabaseAdminClient({ schema: 'api' })
    const { data } = await supabase
      .from('job_runs')
      .select('id, job_name, triggered_by, status, started_at, finished_at, summary, error_text')
      .order('started_at', { ascending: false })
      .limit(limit)
    return { enabled: true, runs: (data ?? []) as Array<Record<string, unknown>> }
  } catch {
    return { enabled: false, runs: [] }
  }
}

