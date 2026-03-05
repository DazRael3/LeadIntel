import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, asHttpError, createCookieBridge } from '@/lib/api/http'
import { runWebhookDeliveries } from '@/lib/integrations/webhooks'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  limit: z.number().int().min(1).max(250).optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, body }) => {
    const bridge = createCookieBridge()
    try {
      const parsed = BodySchema.safeParse(body ?? {})
      const limit = parsed.success ? (parsed.data.limit ?? 50) : 50
      const result = await runWebhookDeliveries({ limit })
      return ok({ result }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/cron/webhooks', undefined, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

