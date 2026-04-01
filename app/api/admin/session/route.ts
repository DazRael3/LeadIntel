import { NextRequest } from 'next/server'
import { fail, ok } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'
import { createCookieBridge } from '@/lib/api/http'
import { ADMIN_SESSION_COOKIE, clearAdminSessionCookie, isValidAdminSessionToken, setAdminSessionCookie } from '@/lib/admin/session'
import { isValidAdminToken } from '@/lib/admin/admin-token'

export const dynamic = 'force-dynamic'

export const POST = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  const token = (request.headers.get('x-admin-token') ?? '').trim()
  if (!isValidAdminToken(token)) {
    return fail('UNAUTHORIZED', 'Unauthorized', undefined, { status: 401 }, bridge, requestId)
  }

  setAdminSessionCookie(bridge)
  return ok({ active: true }, undefined, bridge, requestId)
})

export const DELETE = withApiGuard(async (_request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  clearAdminSessionCookie(bridge)
  return ok({ active: false }, undefined, bridge, requestId)
})

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? null
  const active = isValidAdminSessionToken(cookie)
  return ok({ active }, undefined, undefined, requestId)
})
