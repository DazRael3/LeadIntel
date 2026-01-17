/**
 * Rate Limiting Utilities Tests
 * 
 * Tests for ratelimit.ts including keying strategies and bypass logic.
 * 
 * Run with: npx tsx lib/api/ratelimit.test.ts
 * Or with Node.js test runner: node --test lib/api/ratelimit.test.ts
 */

import { strict as assert } from 'assert'
import { describe, it } from 'node:test'
import { NextRequest } from 'next/server'
import { checkRateLimit, shouldBypassRateLimit, getClientIp, RateLimitConfig, getRateLimitError } from './ratelimit'
import { createCookieBridge } from './http'

// Mock Upstash Redis to avoid requiring actual credentials in tests
const mockRedis = {
  pipeline: () => ({
    zrange: () => mockRedis,
    zadd: () => mockRedis,
    expire: () => mockRedis,
    exec: async () => [[null, []], [null, 1], [null, 1]],
  }),
}

describe('getClientIp', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const request = new NextRequest('http://localhost/api/test', {
      headers: {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      },
    })
    
    const ip = getClientIp(request)
    assert.strictEqual(ip, '192.168.1.1')
  })

  it('should extract IP from x-real-ip header', () => {
    const request = new NextRequest('http://localhost/api/test', {
      headers: {
        'x-real-ip': '10.0.0.1',
      },
    })
    
    const ip = getClientIp(request)
    assert.strictEqual(ip, '10.0.0.1')
  })

  it('should return unknown if no IP headers present', () => {
    const request = new NextRequest('http://localhost/api/test')
    
    const ip = getClientIp(request)
    assert.strictEqual(ip, 'unknown')
  })

  it('should prefer x-forwarded-for over x-real-ip', () => {
    const request = new NextRequest('http://localhost/api/test', {
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'x-real-ip': '10.0.0.1',
      },
    })
    
    const ip = getClientIp(request)
    assert.strictEqual(ip, '192.168.1.1')
  })
})

describe('shouldBypassRateLimit', () => {
  it('should bypass for Stripe webhook with signature', () => {
    const request = new NextRequest('http://localhost/api/stripe/webhook', {
      headers: {
        'stripe-signature': 't=1234567890,v1=signature',
      },
    })
    
    const shouldBypass = shouldBypassRateLimit(request, '/api/stripe/webhook')
    assert.strictEqual(shouldBypass, true)
  })

  it('should not bypass Stripe webhook without signature', () => {
    const request = new NextRequest('http://localhost/api/stripe/webhook')
    
    const shouldBypass = shouldBypassRateLimit(request, '/api/stripe/webhook')
    assert.strictEqual(shouldBypass, false)
  })

  it('should bypass admin digest cron with correct secret', () => {
    // Mock serverEnv.ADMIN_DIGEST_SECRET
    const originalEnv = process.env.ADMIN_DIGEST_SECRET
    process.env.ADMIN_DIGEST_SECRET = 'test-secret'
    
    try {
      const request = new NextRequest('http://localhost/api/digest/run', {
        headers: {
          'x-admin-digest-secret': 'test-secret',
        },
      })
      
      const shouldBypass = shouldBypassRateLimit(request, '/api/digest/run')
      assert.strictEqual(shouldBypass, true)
    } finally {
      if (originalEnv) {
        process.env.ADMIN_DIGEST_SECRET = originalEnv
      } else {
        delete process.env.ADMIN_DIGEST_SECRET
      }
    }
  })

  it('should not bypass admin digest cron with wrong secret', () => {
    const originalEnv = process.env.ADMIN_DIGEST_SECRET
    process.env.ADMIN_DIGEST_SECRET = 'test-secret'
    
    try {
      const request = new NextRequest('http://localhost/api/digest/run', {
        headers: {
          'x-admin-digest-secret': 'wrong-secret',
        },
      })
      
      const shouldBypass = shouldBypassRateLimit(request, '/api/digest/run')
      assert.strictEqual(shouldBypass, false)
    } finally {
      if (originalEnv) {
        process.env.ADMIN_DIGEST_SECRET = originalEnv
      } else {
        delete process.env.ADMIN_DIGEST_SECRET
      }
    }
  })

  it('should not bypass regular routes', () => {
    const request = new NextRequest('http://localhost/api/generate-pitch')
    
    const shouldBypass = shouldBypassRateLimit(request, '/api/generate-pitch')
    assert.strictEqual(shouldBypass, false)
  })
})

describe('RateLimitConfig', () => {
  it('should have different limits for authenticated vs unauthenticated', () => {
    // Auth endpoints
    assert.ok(RateLimitConfig.AUTH.authenticated.limit > RateLimitConfig.AUTH.unauthenticated.limit)
    
    // AI generation endpoints
    assert.ok(RateLimitConfig.AI_GENERATION.authenticated.limit > RateLimitConfig.AI_GENERATION.unauthenticated.limit)
    
    // Read endpoints
    assert.ok(RateLimitConfig.READ.authenticated.limit > RateLimitConfig.READ.unauthenticated.limit)
    
    // Write endpoints
    assert.ok(RateLimitConfig.WRITE.authenticated.limit > RateLimitConfig.WRITE.unauthenticated.limit)
    
    // Checkout endpoints
    assert.ok(RateLimitConfig.CHECKOUT.authenticated.limit > RateLimitConfig.CHECKOUT.unauthenticated.limit)
  })

  it('should have stricter limits for AI generation than read', () => {
    assert.ok(
      RateLimitConfig.AI_GENERATION.authenticated.limit < RateLimitConfig.READ.authenticated.limit
    )
  })

  it('should have stricter limits for auth than read', () => {
    assert.ok(
      RateLimitConfig.AUTH.authenticated.limit < RateLimitConfig.READ.authenticated.limit
    )
  })
})

describe('checkRateLimit', () => {
  it('should return null if Upstash is not configured', async () => {
    // Save original env
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN
    
    // Clear env vars
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    
    try {
      const request = new NextRequest('http://localhost/api/test')
      const result = await checkRateLimit(request, 'user-123', '/api/test', 'READ')
      
      // Should return null when Upstash is not configured
      assert.strictEqual(result, null)
    } finally {
      // Restore env
      if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl
      if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken
    }
  })
})

describe('getRateLimitError', () => {
  it('should return 429 response with rate limit headers', () => {
    const bridge = createCookieBridge()
    
    const result = {
      success: false,
      limit: 10,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60, // 60 seconds from now
    }
    
    const response = getRateLimitError(result, bridge)
    
    assert.strictEqual(response.status, 429)
    
    // Check headers
    const headers = response.headers
    assert.ok(headers.get('Retry-After'))
    assert.ok(headers.get('X-RateLimit-Limit'))
    assert.ok(headers.get('X-RateLimit-Remaining'))
    assert.ok(headers.get('X-RateLimit-Reset'))
  })
})
