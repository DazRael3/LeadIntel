import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { JobName } from '@/lib/jobs/types'

export type LockAcquireResult =
  | { enabled: true; acquired: true }
  | { enabled: true; acquired: false }
  | { enabled: false; acquired: true }

export function defaultJobLockTtlSeconds(job: JobName): number {
  // Hobby-safe default: lock auto-expires after 30 minutes to prevent deadlocks.
  // This is a concurrency guard, not a schedule.
  void job
  return 30 * 60
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

