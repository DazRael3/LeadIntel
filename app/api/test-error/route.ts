/**
 * Test Error Endpoint
 * 
 * Used for validating Sentry error tracking in development.
 * Only available when NODE_ENV is not production.
 * Guard handles dev-only check.
 */

import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok } from '@/lib/api/http'

export const GET = withApiGuard(
  async (request, { requestId }) => {
    // Intentionally throw an error for testing
    // Guard already verified dev-only (blocked in production)
    throw new Error('Test error for Sentry validation - this is intentional')
    
    // This will never be reached
    return ok({ message: 'OK' })
  }
)
