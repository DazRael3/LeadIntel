import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { JobName } from '@/lib/jobs/types'

export type LockAcquireResult =
  | { enabled: true; acquired: true }
  | { enabled: true; acquired: false }
  | { enabled: false; acquired: true }

export function defaultJobLockTtlSeconds(job: JobName): number {
  // Keep these comfortably below the schedule interval to avoid stale-lock blocking.
  if (job === 'lifecycle') return 55 * 60
  if (job === 'digest_lite') return 60 * 60
  if (job === 'kpi_monitor') return 15 * 60
  return 15 * 60
}

export async function tryAcquireJobLock(args: { job: JobName; ttlSeconds?: number }): Promise<LockAcquireResult> {
  try {
    const supabase = createSupabaseAdminClient({ schema: 'api' })
    const ttlSeconds = args.ttlSeconds ?? defaultJobLockTtlSeconds(args.job)
    const { data, error } = await supabase.rpc('try_acquire_job_lock', {
      p_job_name: args.job,
      p_ttl_seconds: ttlSeconds,
    })
    if (error) return { enabled: false, acquired: true }
    if (data === true) return { enabled: true, acquired: true }
    return { enabled: true, acquired: false }
  } catch {
    // If locking infra isn't available, allow the run (best-effort).
    return { enabled: false, acquired: true }
  }
}

export async function releaseJobLock(job: JobName): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient({ schema: 'api' })
    await supabase.rpc('release_job_lock', { p_job_name: job })
  } catch {
    // best-effort
  }
}

