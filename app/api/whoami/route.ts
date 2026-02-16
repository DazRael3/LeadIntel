import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail } from '@/lib/api/http'
import { serverEnv } from '@/lib/env'

/**
 * Debug endpoint to check authentication status
 * Guard enforces authentication (authRequired: true per policy)
 */
export const GET = withApiGuard(
  async (request, { userId, requestId }) => {
    // Hard-disable debug surface area in production.
    if (serverEnv.NODE_ENV === 'production') {
      return fail('NOT_FOUND', 'Route not found', undefined, { status: 404 }, undefined, requestId)
    }
    // Guard already verified authentication, userId is guaranteed to exist
    // This endpoint still returns user info for debugging
    return ok({
      authenticated: true,
      userId: userId || null,
      email: null, // Email not available from guard context
    })
  }
)
