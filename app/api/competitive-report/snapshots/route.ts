import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { getUserTierForGating } from '@/lib/team/gating'
import { hasCapability } from '@/lib/billing/capabilities'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  reportId: z.string().uuid(),
  includeMarkdown: z
    .union([z.literal('0'), z.literal('1')])
    .optional()
    .default('0'),
})

type SnapshotRow = {
  id: string
  created_at: string
  report_version: number
  title: string
  company_name: string
  company_domain: string | null
  input_url: string | null
  sources_used: unknown
  sources_fetched_at: string | null
  report_markdown?: string
  meta: unknown
}

function safeRecord(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' ? (x as Record<string, unknown>) : {}
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    const supabase = createRouteClient(request, bridge)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!hasCapability(tier, 'report_diff')) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { data, error } = await supabase
      .schema('api')
      .from('user_report_snapshots')
      .select(
        parsed.data.includeMarkdown === '1'
          ? 'id, created_at, report_version, title, company_name, company_domain, input_url, sources_used, sources_fetched_at, report_markdown, meta'
          : 'id, created_at, report_version, title, company_name, company_domain, input_url, sources_used, sources_fetched_at, meta'
      )
      .eq('user_id', user.id)
      .eq('report_id', parsed.data.reportId)
      .order('created_at', { ascending: false })
      .limit(25)

    if (error) return ok({ snapshots: [] }, undefined, bridge, requestId)

    const rows = (data ?? []) as unknown as SnapshotRow[]
    return ok(
      {
        snapshots: rows.map((r) => ({
          id: r.id,
          createdAt: r.created_at,
          reportVersion: r.report_version,
          title: r.title,
          companyName: r.company_name,
          companyDomain: r.company_domain,
          inputUrl: r.input_url,
          sourcesFetchedAt: r.sources_fetched_at,
          sourcesUsed: r.sources_used,
          reportMarkdown: typeof r.report_markdown === 'string' ? r.report_markdown : undefined,
          meta: safeRecord(r.meta),
        })),
      },
      undefined,
      bridge,
      requestId
    )
  } catch (e) {
    return asHttpError(e, '/api/competitive-report/snapshots', userId, bridge, requestId)
  }
})

