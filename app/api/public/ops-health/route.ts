import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, asHttpError, createCookieBridge } from '@/lib/api/http'
import { computeOpsHealth } from '@/lib/ops/opsHealth'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (_request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const report = await computeOpsHealth()
    return ok(report, undefined, bridge, requestId)
  } catch (err) {
    return asHttpError(err, '/api/public/ops-health', undefined, bridge, requestId)
  }
})

