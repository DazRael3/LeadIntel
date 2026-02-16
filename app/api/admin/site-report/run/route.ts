import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { serverEnv } from '@/lib/env'
import { runDailySiteReport } from '@/lib/services/siteReports'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

export const POST = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const enabled = serverEnv.ENABLE_SITE_REPORTS === '1' || serverEnv.ENABLE_SITE_REPORTS === 'true'
    if (!enabled) {
      return fail(ErrorCode.FORBIDDEN, 'Site reports disabled', undefined, undefined, bridge, requestId)
    }

    const expected = serverEnv.SITE_REPORT_CRON_SECRET
    const provided = request.headers.get('x-cron-secret')
    if (!expected || !provided || provided !== expected) {
      return fail(ErrorCode.UNAUTHORIZED, 'Unauthorized', undefined, undefined, bridge, requestId)
    }

    const row = await runDailySiteReport()

    if (serverEnv.ENABLE_PRODUCT_ANALYTICS === '1' || serverEnv.ENABLE_PRODUCT_ANALYTICS === 'true') {
      void logProductEvent({
        userId: null,
        eventName: 'site_report.run',
        eventProps: { report_date: row.report_date },
      })
    }

    return ok({ ok: true, reportDate: row.report_date, summary: row.summary }, undefined, bridge, requestId)
  } catch (err) {
    return asHttpError(err, '/api/admin/site-report/run', undefined, bridge, requestId)
  }
})

