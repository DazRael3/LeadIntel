import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const supabase = createRouteClient(request, bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const adminUserId = serverEnv.ADMIN_USER_ID
    if (!adminUserId || user.id !== adminUserId) {
      return fail(ErrorCode.FORBIDDEN, 'Forbidden', undefined, undefined, bridge, requestId)
    }

    const admin = createSupabaseAdminClient()
    const { data, error } = await admin
      .from('site_reports')
      .select('id, report_date, generated_at, summary, notes')
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to load report', { message: error.message }, undefined, bridge, requestId)
    }

    return ok({ report: data ?? null }, undefined, bridge, requestId)
  } catch (err) {
    return asHttpError(err, '/api/admin/site-report/latest', undefined, bridge, requestId)
  }
})

