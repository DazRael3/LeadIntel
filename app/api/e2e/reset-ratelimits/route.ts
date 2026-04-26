import { NextRequest } from 'next/server'
import { ok, fail, ErrorCode } from '@/lib/api/http'
import { isTestEnv } from '@/lib/runtimeFlags'
import { resetAllRateLimits } from '@/lib/api/ratelimit-memory'
import { timingSafeEqualAscii } from '@/lib/api/cron-auth'

export const dynamic = 'force-dynamic'

/**
 * E2E-only helper to keep Playwright deterministic.
 *
 * This endpoint is intentionally not behind withApiGuard because test boot
 * order relies on being able to call it before auth/session setup.
 * It is still locked down by:
 * - E2E_MODE=true (or NODE_ENV=test)
 * - x-e2e-token header matching E2E_TOKEN
 */
function isEnabled(): boolean {
  if (isTestEnv()) return true
  return (process.env.E2E_MODE ?? '').trim().toLowerCase() === 'true'
}

function isTokenValid(providedToken: string | null, expectedToken: string): boolean {
  if (!providedToken) return false
  return timingSafeEqualAscii(providedToken, expectedToken)
}

export async function GET(request: NextRequest) {
  if (!isEnabled()) {
    return fail(ErrorCode.NOT_FOUND, 'Route not found', undefined, { status: 404 })
  }

  const expectedToken = (process.env.E2E_TOKEN ?? '').trim()
  if (!expectedToken) {
    return fail(ErrorCode.SERVICE_UNAVAILABLE, 'E2E token not configured', undefined, { status: 503 })
  }
  const providedToken = request.headers.get('x-e2e-token')
  if (!isTokenValid(providedToken, expectedToken)) {
    return fail(ErrorCode.UNAUTHORIZED, 'Missing or invalid x-e2e-token header', undefined, { status: 401 })
  }

  resetAllRateLimits()
  return ok({ reset: true })
}

