/**
 * Request ID Generation and Correlation
 * 
 * Generates unique request IDs for request correlation across logs and error tracking.
 * Request IDs are included in API error responses and Sentry events.
 * 
 * Uses Web Crypto API for Edge runtime compatibility.
 */

import { NextRequest } from 'next/server'

/**
 * Header name for request ID
 */
export const REQUEST_ID_HEADER = 'X-Request-ID'

/**
 * Generates a unique request ID using Web Crypto API (Edge-compatible)
 * Format: timestamp-base32random (e.g., "1704067200-a1b2c3d4")
 */
export function generateRequestId(): string {
  const timestamp = Math.floor(Date.now() / 1000)
  
  // Use Web Crypto API for Edge runtime compatibility
  // Generate 4 random bytes (8 hex characters)
  const randomArray = new Uint8Array(4)
  crypto.getRandomValues(randomArray)
  const random = Array.from(randomArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toLowerCase()
    .slice(0, 8)
  
  return `${timestamp}-${random}`
}

/**
 * Gets or generates a request ID from the request
 * Checks for X-Request-ID header first, then generates if missing
 */
export function getOrCreateRequestId(request: NextRequest): string {
  // Check for existing request ID header
  const existingId = request.headers.get(REQUEST_ID_HEADER)
  if (existingId) {
    return existingId
  }

  // Generate new request ID
  return generateRequestId()
}

/**
 * Sets request ID in response headers
 */
export function setRequestIdHeader(
  response: Response,
  requestId: string
): void {
  response.headers.set(REQUEST_ID_HEADER, requestId)
}
