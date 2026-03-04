import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { runJob } from '@/lib/jobs/runJob'
import { persistJobRun } from '@/lib/jobs/persist'
import type { JobName } from '@/lib/jobs/types'
import { releaseJobLock, tryAcquireJobLock } from '@/lib/jobs/lock'

const BodySchema = z.object({
  job: z.enum(['lifecycle', 'digest_lite', 'kpi_monitor', 'content_audit']),
  dryRun: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET ?? '').trim()
  const expected = `Bearer ${secret}`
  const auth = (request.headers.get('authorization') ?? '').trim()
  if (secret && auth === expected) return true

  // Backward compatibility: x-cron-secret header.
  const legacy = (request.headers.get('x-cron-secret') ?? '').trim()
  if (secret && legacy === secret) return true

  return false
}

function parseDryRun(raw: string | null): boolean | undefined {
  if (!raw) return undefined
  const v = raw.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes') return true
  if (v === '0' || v === 'false' || v === 'no') return false
  return undefined
}

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    // Vercel Cron: Authorization: Bearer ${CRON_SECRET}
    if (!isAuthorizedCron(request)) {
      return fail(ErrorCode.UNAUTHORIZED, 'Unauthorized', undefined, { status: 401 }, bridge, requestId)
    }

    const url = new URL(request.url)
    const jobRaw = url.searchParams.get('job')
    const dryRun = parseDryRun(url.searchParams.get('dryRun'))

    const parsed = BodySchema.safeParse({ job: jobRaw, dryRun })
    if (!parsed.success) {
      return fail(ErrorCode.VALIDATION_ERROR, 'Invalid cron payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)
    }

    const job = parsed.data.job as JobName
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
      const result = await runJob(job, { triggeredBy: 'cron', dryRun: parsed.data.dryRun })
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
      if (!isAuthorizedCron(request)) {
        return fail(ErrorCode.UNAUTHORIZED, 'Unauthorized', undefined, { status: 401 }, bridge, requestId)
      }

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Invalid cron payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)
      }

      const job = parsed.data.job as JobName
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

