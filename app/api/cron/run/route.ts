import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { requireCronAuth } from '@/lib/cron/auth'
import { runJob } from '@/lib/jobs/runJob'
import { persistJobRun } from '@/lib/jobs/persist'
import type { JobName } from '@/lib/jobs/types'
import { releaseJobLock, tryAcquireJobLock } from '@/lib/jobs/lock'

const BodySchema = z.object({
  job: z.enum([
    'lifecycle',
    'digest_lite',
    'kpi_monitor',
    'content_audit',
    'growth_cycle',
    'sources_refresh',
    'prospect_watch',
    'prospect_watch_digest',
  ]),
  dryRun: z.boolean().optional(),
  limit: z.number().int().optional(),
})

export const dynamic = 'force-dynamic'

function parseDryRun(raw: string | null): boolean | undefined {
  if (!raw) return undefined
  const v = raw.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes') return true
  if (v === '0' || v === 'false' || v === 'no') return false
  return undefined
}

function parseLimit(raw: string | null): number | undefined {
  if (!raw) return undefined
  const n = Number.parseInt(raw.trim(), 10)
  return Number.isFinite(n) ? n : undefined
}

function clampLimit(n: number): number {
  return Math.max(10, Math.min(1000, Math.floor(n)))
}

function clampGrowthLimit(n: number): number {
  return Math.max(1, Math.min(10, Math.floor(n)))
}

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const authFail = requireCronAuth(request)
    if (authFail) return authFail

    const url = new URL(request.url)
    const jobRaw = url.searchParams.get('job')
    const dryRun = parseDryRun(url.searchParams.get('dryRun'))
    const limitRaw = parseLimit(url.searchParams.get('limit'))

    const parsed = BodySchema.safeParse({
      job: jobRaw,
      dryRun,
      limit: typeof limitRaw === 'number' ? limitRaw : undefined,
    })
    if (!parsed.success) {
      return fail(ErrorCode.VALIDATION_ERROR, 'Invalid cron payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)
    }

    const job = parsed.data.job as JobName
    const limit =
      job === 'lifecycle'
        ? clampLimit(parsed.data.limit ?? 200)
        : job === 'growth_cycle'
          ? clampGrowthLimit(parsed.data.limit ?? 3)
          : job === 'sources_refresh'
            ? clampLimit(parsed.data.limit ?? 20)
            : job === 'prospect_watch'
              ? clampLimit(parsed.data.limit ?? 50)
          : undefined
    const startedAt = new Date().toISOString()

    const lock = await tryAcquireJobLock({ job })
    if (lock.enabled && !lock.acquired) {
      const finishedAt = new Date().toISOString()
      const result = { job, status: 'skipped' as const, summary: { reason: 'already_running' }, startedAt, finishedAt }
      void persistJobRun({
        job,
        triggeredBy: 'cron',
        status: 'skipped',
        startedAt,
        finishedAt,
        summary: result.summary,
        errorText: null,
      })
      return ok(result, undefined, bridge, requestId)
    }

    try {
      const result = await runJob(job, { triggeredBy: 'cron', dryRun: parsed.data.dryRun, limit })
      return ok(result, undefined, bridge, requestId)
    } finally {
      await releaseJobLock(job)
    }
  } catch (error) {
    return asHttpError(error, '/api/cron/run', undefined, bridge, requestId)
  }
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const authFail = requireCronAuth(request)
      if (authFail) return authFail

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Invalid cron payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)
      }

      const job = parsed.data.job as JobName
      const limit =
        job === 'lifecycle'
          ? clampLimit(parsed.data.limit ?? 200)
          : job === 'growth_cycle'
            ? clampGrowthLimit(parsed.data.limit ?? 3)
            : job === 'sources_refresh'
              ? clampLimit(parsed.data.limit ?? 20)
              : job === 'prospect_watch'
                ? clampLimit(parsed.data.limit ?? 50)
            : undefined
      const startedAt = new Date().toISOString()

      const lock = await tryAcquireJobLock({ job })
      if (lock.enabled && !lock.acquired) {
        const finishedAt = new Date().toISOString()
        const result = { job, status: 'skipped' as const, summary: { reason: 'already_running' }, startedAt, finishedAt }
        void persistJobRun({
          job,
          triggeredBy: 'cron',
          status: 'skipped',
          startedAt,
          finishedAt,
          summary: result.summary,
          errorText: null,
        })
        return ok(result, undefined, bridge, requestId)
      }

      try {
        const result = await runJob(job, {
          triggeredBy: 'cron',
          dryRun: parsed.data.dryRun,
          limit,
        })
        return ok(result, undefined, bridge, requestId)
      } finally {
        await releaseJobLock(job)
      }
    } catch (error) {
      return asHttpError(error, '/api/cron/run', undefined, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

