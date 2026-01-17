/**
 * Policy-Based Rate Limiting
 * 
 * Direct rate limiting using policy-defined limits instead of category mapping.
 * This allows each route to have its own specific rate limits as defined in the policy.
 */

import { NextRequest } from 'next/server'
import { Ratelimit, type Duration } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { serverEnv } from '@/lib/env'
import { isE2E, isTestEnv, isCI } from '@/lib/runtimeFlags'
import type { RoutePolicy } from './policy'
import { getClientIp } from './ratelimit'
import { checkPolicyRateLimitMemory } from './ratelimit-memory'

/**
 * Singleton flag to track if we've logged the warning about missing Redis
 * Prevents spam in development logs
 */
let hasLoggedWarning = false

/**
 * Check if we're in a test/e2e environment where we should use in-memory limiter
 */
function shouldUseMemoryLimiter(): boolean {
  return isE2E() || isTestEnv() || isCI()
}

/**
 * Create Upstash Redis client using Redis.fromEnv()
 * Automatically reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * 
 * Behavior:
 * - Test/E2E: Return null (in-memory limiter will be used instead)
 * - Development: If env vars missing, log warning once and return null
 * - Production: If env vars missing, return null (caller should return 503)
 */
function createRedisClient(): Redis | null {
  // In test/e2e environments, skip Redis entirely (use in-memory limiter)
  if (shouldUseMemoryLimiter()) {
    return null
  }
  
  try {
    // Redis.fromEnv() automatically reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
    return Redis.fromEnv()
  } catch (error) {
    // Redis.fromEnv() throws if env vars are missing
    const isDev = serverEnv.NODE_ENV === 'development'
    
    if (isDev && !hasLoggedWarning) {
      console.warn('[ratelimit] Upstash Redis not configured (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN required). Rate limiting disabled.')
      hasLoggedWarning = true
    }
    
    return null
  }
}

/**
 * Create rate limiter instance for a specific configuration
 */
function createRateLimiter(
  limit: number,
  window: Duration,
  identifier: string
): Ratelimit | null {
  const redis = createRedisClient()
  if (!redis) {
    return null
  }
  
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    prefix: `@leadintel/ratelimit/${identifier}`,
  })
}

/**
 * Rate limit check result
 */
export interface PolicyRateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Special error type to indicate Redis is not configured
 * Used to return 503 in production when Redis env vars are missing
 */
export class RedisNotConfiguredError extends Error {
  constructor(message: string = 'Rate limiting service unavailable') {
    super(message)
    this.name = 'RedisNotConfiguredError'
  }
}

/**
 * Check rate limit using policy-defined limits
 * 
 * @param request - Next.js request object
 * @param userId - Optional user ID (if authenticated)
 * @param route - Route path for keying
 * @param policy - Route policy with rate limit configuration
 * @returns Rate limit result, null if rate limiting is disabled (dev only), or throws RedisNotConfiguredError in production
 * @throws {RedisNotConfiguredError} In production if Redis env vars are missing
 */
export async function checkPolicyRateLimit(
  request: NextRequest,
  userId: string | null,
  route: string,
  policy: RoutePolicy
): Promise<PolicyRateLimitResult | null> {
  // In test/e2e environments, use in-memory limiter (deterministic, enforces limits)
  if (shouldUseMemoryLimiter()) {
    return checkPolicyRateLimitMemory(request, userId, route, policy)
  }
  
  // Get Redis client
  const redis = createRedisClient()
  if (!redis) {
    // In production, throw error to return 503
    // In development, return null to disable rate limiting
    if (serverEnv.NODE_ENV === 'production') {
      throw new RedisNotConfiguredError('Rate limiting service unavailable. UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured in production.')
    }
    return null
  }
  
  const isAuthenticated = userId !== null
  
  // Select appropriate limit based on authentication status
  const limit = isAuthenticated ? policy.rateLimit.authPerMin : policy.rateLimit.ipPerMin
  
  // For webhooks (Tier WEBHOOK), always use IP-based
  const effectiveUserId = policy.tier === 'WEBHOOK' ? null : userId
  
  // Create identifier for rate limit key
  const identifier = effectiveUserId ? `user:${effectiveUserId}` : `ip:${getClientIp(request)}`
  const key = `${identifier}:${route}`
  
  // Create rate limiter with policy-defined limit (per minute)
  const ratelimit = createRateLimiter(limit, '1 m' as Duration, key)
  if (!ratelimit) {
    return null
  }
  
  // Check rate limit
  const result = await ratelimit.limit(key)
  
  return {
    success: result.success,
    limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}
