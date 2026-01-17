/**
 * Rate Limiting Utilities
 * 
 * Provides Upstash Redis-based rate limiting with different strategies:
 * - Authenticated: userId + route
 * - Unauthenticated: ip + route
 * 
 * Different limits for:
 * - Auth endpoints (login, signup)
 * - AI generation endpoints (stricter)
 * - General read endpoints (looser)
 */

import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit, type Duration } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { serverEnv } from '@/lib/env'

/**
 * Rate limit configuration per route category
 */
export const RateLimitConfig = {
  /**
   * Auth endpoints (login, signup, verify-email)
   * Stricter limits to prevent brute force attacks
   */
  AUTH: {
    authenticated: { limit: 10, window: '1 m' }, // 10 requests per minute
    unauthenticated: { limit: 5, window: '1 m' }, // 5 requests per minute
  },
  
  /**
   * AI generation endpoints (generate-pitch, generate-sequence, generate-battle-card, generate-linkedin-comment)
   * Stricter limits due to OpenAI API costs
   */
  AI_GENERATION: {
    authenticated: { limit: 20, window: '1 h' }, // 20 requests per hour
    unauthenticated: { limit: 3, window: '1 h' }, // 3 requests per hour
  },
  
  /**
   * General read endpoints (history, tags, plan, whoami)
   * Looser limits for normal usage
   */
  READ: {
    authenticated: { limit: 100, window: '1 m' }, // 100 requests per minute
    unauthenticated: { limit: 30, window: '1 m' }, // 30 requests per minute
  },
  
  /**
   * Write endpoints (settings, tags POST, unlock-lead)
   * Moderate limits
   */
  WRITE: {
    authenticated: { limit: 60, window: '1 m' }, // 60 requests per minute
    unauthenticated: { limit: 10, window: '1 m' }, // 10 requests per minute
  },
  
  /**
   * Checkout endpoint
   * Stricter to prevent abuse
   */
  CHECKOUT: {
    authenticated: { limit: 5, window: '1 h' }, // 5 requests per hour
    unauthenticated: { limit: 1, window: '1 h' }, // 1 request per hour
  },
} as const

/**
 * Get client IP from request headers
 * Exported for testing
 */
export function getClientIp(request: NextRequest): string {
  // Check for forwarded IP (from proxy/load balancer)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim()
  }
  
  // Check for real IP header
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  
  // Fallback to connection remote address (if available)
  // Note: In serverless environments, this may not be available
  return 'unknown'
}

/**
 * Singleton flag to track if we've logged the warning about missing Redis
 * Prevents spam in development logs
 */
let hasLoggedWarning = false

/**
 * Check if we're in a test/e2e environment where rate limiting should be disabled
 */
function isTestEnvironment(): boolean {
  return (
    serverEnv.NODE_ENV === 'test' ||
    process.env.PLAYWRIGHT === '1' ||
    process.env.E2E === '1' ||
    process.env.CI === 'true'
  )
}

/**
 * Create Upstash Redis client using Redis.fromEnv()
 * Automatically reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * 
 * Behavior:
 * - Test/E2E: Return null (no-op limiter will be used)
 * - Development: If env vars missing, log warning once and return null
 * - Production: If env vars missing, return null (caller should handle appropriately)
 */
function createRedisClient(): Redis | null {
  // In test/e2e environments, skip Redis entirely
  if (isTestEnvironment()) {
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
  config: { limit: number; window: string },
  identifier: string
): Ratelimit | null {
  const redis = createRedisClient()
  if (!redis) {
    return null
  }
  
  const windowDuration: Duration = config.window as Duration
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, windowDuration),
    analytics: true,
    prefix: `@leadintel/ratelimit/${identifier}`,
  })
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Check rate limit for a request
 * 
 * @param request - Next.js request object
 * @param userId - Optional user ID (if authenticated)
 * @param route - Route path for keying
 * @param category - Rate limit category (AUTH, AI_GENERATION, READ, WRITE, CHECKOUT)
 * @returns Rate limit result or null if rate limiting is disabled
 */
export async function checkRateLimit(
  request: NextRequest,
  userId: string | null,
  route: string,
  category: keyof typeof RateLimitConfig
): Promise<RateLimitResult | null> {
  // In test/e2e environments, always allow (no-op limiter)
  if (isTestEnvironment()) {
    const config = RateLimitConfig[category]
    const isAuthenticated = userId !== null
    const limitConfig = isAuthenticated ? config.authenticated : config.unauthenticated
    return {
      success: true,
      limit: limitConfig.limit,
      remaining: limitConfig.limit,
      reset: Math.floor(Date.now() / 1000) + 60,
    }
  }
  
  // Skip rate limiting if Upstash is not configured
  const redis = createRedisClient()
  if (!redis) {
    return null
  }
  
  const config = RateLimitConfig[category]
  const isAuthenticated = userId !== null
  
  // Select appropriate limit based on authentication status
  const limitConfig = isAuthenticated ? config.authenticated : config.unauthenticated
  
  // Create identifier for rate limit key
  const identifier = isAuthenticated ? `user:${userId}` : `ip:${getClientIp(request)}`
  const key = `${identifier}:${route}`
  
  // Create rate limiter
  const ratelimit = createRateLimiter(limitConfig, key)
  if (!ratelimit) {
    return null
  }
  
  // Check rate limit
  const result = await ratelimit.limit(key)
  
  return {
    success: result.success,
    limit: limitConfig.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

/**
 * Bypass rate limiting for specific routes
 * Used for internal cron jobs, webhooks with signature verification, etc.
 */
export function shouldBypassRateLimit(
  request: NextRequest,
  route: string
): boolean {
  // Stripe webhook: verify signature first, then bypass rate limit
  if (route === '/api/stripe/webhook') {
    // Check for Stripe signature header (verification happens in route handler)
    const stripeSignature = request.headers.get('stripe-signature')
    if (stripeSignature) {
      return true
    }
  }
  
  // Admin digest cron: check for admin secret header
  if (route === '/api/digest/run') {
    const adminSecret = request.headers.get('x-admin-digest-secret')
    if (adminSecret && adminSecret === serverEnv.ADMIN_DIGEST_SECRET) {
      return true
    }
  }
  
  // Internal health checks or monitoring (if needed)
  // Add more bypass logic here as needed
  
  return false
}

/**
 * Get rate limit error response
 * Returns standardized 429 response with rate limit details
 */
export function getRateLimitError(
  result: RateLimitResult,
  cookieBridge?: NextResponse,
  requestId?: string
): NextResponse {
  // Import here to avoid circular dependency
  const { fail, ErrorCode } = require('./http')
  
  const resetDate = new Date(result.reset * 1000)
  const retryAfter = Math.ceil((result.reset * 1000 - Date.now()) / 1000)
  
  return fail(
    ErrorCode.RATE_LIMIT_EXCEEDED,
    'Rate limit exceeded',
    {
      limit: result.limit,
      remaining: result.remaining,
      reset: resetDate.toISOString(),
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.reset),
      },
    },
    cookieBridge,
    requestId
  )
}
