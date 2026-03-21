export type JobName =
  | 'lifecycle'
  | 'digest_lite'
  | 'kpi_monitor'
  | 'content_audit'
  | 'growth_cycle'
  | 'sources_refresh'
  | 'prospect_watch'
  | 'prospect_watch_digest'
export type TriggeredBy = 'cron' | 'admin'
export type JobStatus = 'ok' | 'skipped' | 'error'

export type JobResult = {
  job: JobName
  status: JobStatus
  summary: Record<string, unknown>
  startedAt: string
  finishedAt: string
}

