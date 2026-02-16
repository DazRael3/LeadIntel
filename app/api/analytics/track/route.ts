import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { serverEnv } from '@/lib/env'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const TrackBodySchema = z.object({
  eventName: z.string().trim().min(1).max(64),
  eventProps: z.record(z.string(), z.unknown()).optional(),
})

export const POST = withApiGuard(
  async (_request: NextRequest, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const enabled = serverEnv.ENABLE_PRODUCT_ANALYTICS === '1' || serverEnv.ENABLE_PRODUCT_ANALYTICS === 'true'
      if (!enabled) {
        return ok({ ok: true }, undefined, bridge, requestId)
      }

      const parsed = body as z.infer<typeof TrackBodySchema>
      await logProductEvent({
        userId,
        eventName: parsed.eventName,
        eventProps: parsed.eventProps ?? {},
      })
      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (err) {
      return asHttpError(err, '/api/analytics/track', undefined, bridge, requestId)
    }
  },
  { bodySchema: TrackBodySchema }
)

