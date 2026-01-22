import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, asHttpError } from '@/lib/api/http'
import { getHealthReport } from '@/lib/services/health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (_request: NextRequest, { requestId }) => {
  try {
    const report = await getHealthReport()
    return ok(report, undefined, undefined, requestId)
  } catch (error) {
    return asHttpError(error, '/api/health', undefined, undefined, requestId)
  }
})

