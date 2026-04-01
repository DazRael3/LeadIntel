import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { isValidAdminToken } from '@/lib/admin/admin-token'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const token = request.headers.get('x-admin-token')
    if (!isValidAdminToken(token)) {
      return fail(ErrorCode.NOT_FOUND, 'Not found', undefined, { status: 404 }, bridge, requestId)
    }

    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { data, error } = await admin
      .from('content_audit_reports')
      .select('id, created_at, status, failures, summary')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to load content audit report', { message: error.message }, undefined, bridge, requestId)
    }

    return ok({ report: data ?? null }, undefined, bridge, requestId)
  } catch (err) {
    return asHttpError(err, '/api/admin/content-audit/latest', undefined, bridge, requestId)
  }
})

