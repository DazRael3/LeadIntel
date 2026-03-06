import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function readAdminToken(request: NextRequest): string | null {
  const header = (request.headers.get('x-admin-token') ?? '').trim()
  if (header) return header
  const url = new URL(request.url)
  const q = (url.searchParams.get('token') ?? '').trim()
  return q || null
}

function isValidAdminToken(provided: string | null): boolean {
  const expected = (process.env.ADMIN_TOKEN ?? '').trim()
  if (!expected) return false
  return Boolean(provided) && provided === expected
}

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const token = readAdminToken(request)
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

