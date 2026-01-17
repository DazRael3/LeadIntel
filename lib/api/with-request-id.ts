/**
 * Request ID Middleware Helper
 * 
 * Provides a helper to extract or generate request IDs in API routes.
 */

import { NextRequest } from 'next/server'
import { getOrCreateRequestId } from '@/lib/observability/request-id'

/**
 * Gets or creates a request ID for request correlation
 * Use this at the start of API route handlers
 * 
 * @param request - Next.js request object
 * @returns Request ID string
 * 
 * @example
 * export async function POST(request: NextRequest) {
 *   const requestId = getRequestId(request)
 *   // ... rest of handler
 * }
 */
export function getRequestId(request: NextRequest): string {
  return getOrCreateRequestId(request)
}
