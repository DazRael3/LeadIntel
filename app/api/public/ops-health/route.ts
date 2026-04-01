import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { computeOpsHealth } from '@/lib/ops/opsHealth'
import { isValidAdminToken } from '@/lib/admin/admin-token'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const token = (request.headers.get('x-admin-token') ?? '').trim()
    if (!isValidAdminToken(token)) {
      return fail(ErrorCode.NOT_FOUND, 'Not found', undefined, { status: 404 }, bridge, requestId)
    }

    const report = await computeOpsHealth()
    return ok(report, undefined, bridge, requestId)
  } catch (err) {
    return asHttpError(err, '/api/public/ops-health', undefined, bridge, requestId)
  }
})

