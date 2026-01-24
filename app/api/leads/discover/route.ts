import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok } from '@/lib/api/http'
import { captureBreadcrumb } from '@/lib/observability/sentry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Phase-1 placeholder: Lead discovery is environment- and integration-dependent
 * (news sources, enrichment, scraping). This route is wired for cron auth + rate
 * limiting now, so production schedulers can call it safely.
 */
export const POST = withApiGuard(async (_request: NextRequest, { requestId }) => {
  captureBreadcrumb({
    category: 'cron',
    level: 'info',
    message: 'leads_discover_invoked',
    data: { route: '/api/leads/discover', requestId },
  })
  return ok(
    {
      discovered: 0,
      inserted: 0,
      message: 'Lead discovery not configured in this deployment',
    },
    undefined,
    undefined,
    requestId
  )
})

