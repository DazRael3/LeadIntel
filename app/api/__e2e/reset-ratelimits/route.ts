import { NextRequest } from 'next/server'
import { ok, fail, ErrorCode } from '@/lib/api/http'
import { isE2E, isTestEnv } from '@/lib/runtimeFlags'
import { resetAllRateLimits } from '@/lib/api/ratelimit-memory'

export const dynamic = 'force-dynamic'

/**
 * E2E-only helper to keep Playwright deterministic.
 *
 * This endpoint is intentionally:
 * - unauthenticated
 * - not behind withApiGuard (to avoid rate limiting and auth dependencies)
 *
 * It is *fail-closed* outside E2E/test environments.
 */
export async function GET(_request: NextRequest) {
  if (!(isE2E() || isTestEnv())) {
    return fail(ErrorCode.NOT_FOUND, 'Route not found', undefined, { status: 404 })
  }
  resetAllRateLimits()
  return ok({ reset: true })
}

