import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { serverEnv } from '@/lib/env'
import { runJob } from '@/lib/jobs/runJob'
import type { JobName } from '@/lib/jobs/types'

const BodySchema = z.object({
  job: z.enum(['lifecycle', 'digest_lite', 'kpi_monitor', 'content_audit']),
  dryRun: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const header = request.headers.get('x-cron-secret') ?? ''
      const expected = serverEnv.CRON_SECRET ?? ''
      if (!expected || header !== expected) {
        return fail(ErrorCode.UNAUTHORIZED, 'Unauthorized', undefined, undefined, bridge, requestId)
      }

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Invalid cron payload', parsed.error.flatten(), { status: 422 }, bridge, requestId)
      }

      const result = await runJob(parsed.data.job as JobName, {
        triggeredBy: 'cron',
        dryRun: parsed.data.dryRun,
      })
      return ok(result, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/cron/run', undefined, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

