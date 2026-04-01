import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { runEnvDoctor } from '@/lib/ops/envDoctor'
import { isAdminRequestAuthorized } from '@/lib/admin/access'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    if (!isAdminRequestAuthorized({ request })) {
      return fail(ErrorCode.NOT_FOUND, 'Not found', undefined, { status: 404 }, bridge, requestId)
    }

    const report = runEnvDoctor()
    return ok(report, undefined, bridge, requestId)
  } catch (err) {
    return asHttpError(err, '/api/admin/env-doctor', undefined, bridge, requestId)
  }
})

