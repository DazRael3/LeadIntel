import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok } from '@/lib/api/http'

/**
 * Debug endpoint to check authentication status
 * Guard enforces authentication (authRequired: true per policy)
 */
export const GET = withApiGuard(
  async (request, { userId, requestId }) => {
    // Guard already verified authentication, userId is guaranteed to exist
    // This endpoint still returns user info for debugging
    return ok({
      authenticated: true,
      userId: userId || null,
      email: null, // Email not available from guard context
    })
  }
)
