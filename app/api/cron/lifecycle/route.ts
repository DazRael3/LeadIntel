import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { runLifecycleCron } from '@/lib/growth/lifecycle'

export const dynamic = 'force-dynamic'

export const POST = withApiGuard(async (_request: NextRequest, { isCron, requestId }) => {
  const bridge = createCookieBridge()
  try {
    if (!isCron) {
      return fail(ErrorCode.UNAUTHORIZED, 'Unauthorized', undefined, undefined, bridge, requestId)
    }
    const summary = await runLifecycleCron()
    return ok(summary, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/cron/lifecycle', undefined, bridge, requestId)
  }
})

