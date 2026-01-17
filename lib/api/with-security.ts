/**
 * Security Wrapper for API Routes
 * 
 * Provides a wrapper function to add origin validation and security headers
 * to API route handlers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateOrigin } from './security'
import { fail, ErrorCode } from './http'

/**
 * Wrapper for API route handlers that adds origin validation
 * 
 * @param handler - The route handler function
 * @param route - Route path for validation
 * @returns Wrapped handler with origin validation
 * 
 * @example
 * export const POST = withOriginValidation(
 *   async (request: NextRequest) => {
 *     // Your handler code
 *   },
 *   '/api/generate-pitch'
 * )
 */
export function withOriginValidation<T extends NextRequest>(
  handler: (request: T) => Promise<NextResponse>,
  route: string
) {
  return async (request: T): Promise<NextResponse> => {
    // Validate origin for state-changing requests
    const originError = validateOrigin(request, route)
    if (originError) {
      return originError
    }
    
    // Call the original handler
    return handler(request)
  }
}
