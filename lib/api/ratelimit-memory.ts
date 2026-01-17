/**
 * In-Memory Rate Limiter for E2E/Test Environments
 * 
 * Provides deterministic rate limiting without external dependencies.
 * Uses fixed-window algorithm matching Upstash Ratelimit behavior.
 */

import { NextRequest } from 'next/server'
import type { RoutePolicy } from './policy'
import { getClientIp } from './ratelimit'

/**
 * Rate limit check result (matches Upstash Ratelimit interface)
 */
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * In-memory rate limit entry
 */
interface RateLimitEntry {
  count: number
  resetAt: number // Unix timestamp (seconds)
}

/**
 * In-memory store for rate limit counters
 * Key format: `${identifier}:${route}`
 */
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Window size in milliseconds (1 minute = 60000ms)
 */
const WINDOW_MS = 60 * 1000

/**
 * Clean up expired entries periodically
 */
function cleanupExpiredEntries(): void {
  const now = Math.floor(Date.now() / 1000)
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000)
}

/**
 * Check rate limit using in-memory store
 * 
 * @param request - Next.js request object
 * @param userId - Optional user ID (if authenticated)
 * @param route - Route path for keying
 * @param policy - Route policy with rate limit configuration
 * @returns Rate limit result
 */
export async function checkPolicyRateLimitMemory(
  request: NextRequest,
  userId: string | null,
  route: string,
  policy: RoutePolicy
): Promise<RateLimitResult> {
  const isAuthenticated = userId !== null
  
  // Select appropriate limit based on authentication status
  const limit = isAuthenticated ? policy.rateLimit.authPerMin : policy.rateLimit.ipPerMin
  
  // For webhooks (Tier WEBHOOK), always use IP-based
  const effectiveUserId = policy.tier === 'WEBHOOK' ? null : userId
  
  // Create identifier for rate limit key
  const identifier = effectiveUserId ? `user:${effectiveUserId}` : `ip:${getClientIp(request)}`
  const key = `${identifier}:${route}`
  
  const now = Date.now()
  const nowSeconds = Math.floor(now / 1000)
  
  // Get or create entry
  let entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetAt < nowSeconds) {
    // Create new window
    entry = {
      count: 0,
      resetAt: nowSeconds + Math.floor(WINDOW_MS / 1000), // Reset in 60 seconds
    }
  }
  
  // Increment counter
  entry.count++
  rateLimitStore.set(key, entry)
  
  // Check if limit exceeded
  const success = entry.count <= limit
  const remaining = Math.max(0, limit - entry.count)
  
  return {
    success,
    limit,
    remaining,
    reset: entry.resetAt,
  }
}

/**
 * Reset rate limit for a specific key (useful for testing)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key)
}

/**
 * Reset all rate limits (useful for testing)
 */
export function resetAllRateLimits(): void {
  rateLimitStore.clear()
}
