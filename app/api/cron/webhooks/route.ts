import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, asHttpError, createCookieBridge } from '@/lib/api/http'
import { runWebhookDeliveries } from '@/lib/integrations/webhooks'
import { requireCronAuth } from '@/lib/cron/auth'
import { persistJobRun } from '@/lib/jobs/persist'
import { releaseJobLock, tryAcquireJobLock } from '@/lib/jobs/lock'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  limit: z.number().int().min(1).max(250).optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, body }) => {
    const bridge = createCookieBridge()
    try {
      const authFail = requireCronAuth(request)
      if (authFail) return authFail

      const parsed = BodySchema.safeParse(body ?? {})
      const limit = parsed.success ? (parsed.data.limit ?? 50) : 50
      const job = 'webhook_deliveries' as const
      const startedAt = new Date().toISOString()

      const lock = await tryAcquireJobLock({ job })
      if (lock.enabled && !lock.acquired) {
        const finishedAt = new Date().toISOString()
        const result = { processed: 0, sent: 0, failed: 0, pending: 0, reason: 'already_running' as const }
        void persistJobRun({
          job,
          triggeredBy: 'cron',
          status: 'skipped',
          startedAt,
          finishedAt,
          summary: result,
          errorText: null,
        })
        return ok({ result }, undefined, bridge, requestId)
      }

      try {
        const result = await runWebhookDeliveries({ limit })
        const finishedAt = new Date().toISOString()
        void persistJobRun({
          job,
          triggeredBy: 'cron',
          status: result.failed > 0 ? 'error' : 'ok',
          startedAt,
          finishedAt,
          summary: result,
          errorText: result.failed > 0 ? 'webhook_delivery_failures' : null,
        })
        return ok({ result }, undefined, bridge, requestId)
      } finally {
        await releaseJobLock(job)
      }
    } catch (error) {
      return asHttpError(error, '/api/cron/webhooks', undefined, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

