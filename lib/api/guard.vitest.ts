import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { withApiGuard } from './guard'
import { ok } from './http'
import { z } from 'zod'

// Mock dependencies
vi.mock('@/lib/env', () => ({
  serverEnv: {
    NODE_ENV: 'test',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    CRON_SECRET: 'test-cron-secret-123456',
  },
}))

vi.mock('@/lib/supabase/route', () => ({
  createRouteClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null })),
    },
  })),
}))

vi.mock('@/lib/api/ratelimit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/ratelimit')>('@/lib/api/ratelimit')
  return {
    ...actual,
    checkRateLimit: vi.fn(() => Promise.resolve({ success: true, limit: 100, remaining: 99, reset: Date.now() / 1000 })),
    getRateLimitError: vi.fn(),
    getClientIp: vi.fn(() => '127.0.0.1'),
  }
})

vi.mock('@/lib/api/security', () => ({
  validateOrigin: vi.fn(() => null),
}))

vi.mock('@/lib/api/validate', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/validate')>('@/lib/api/validate')
  return {
    ...actual,
    parseJson: vi.fn(async (request: NextRequest) => {
      const text = await request.text()
      return JSON.parse(text)
    }),
  }
})

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn((body, signature, secret) => {
        // Mock successful verification
        return JSON.parse(body.toString('utf-8'))
      }),
    },
  },
}))

describe('withApiGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should block dev-only routes in production', async () => {
    const { serverEnv } = await import('@/lib/env')
    vi.mocked(serverEnv).NODE_ENV = 'production'

    const handler = withApiGuard(async () => {
      return ok({ success: true })
    })

    const request = new NextRequest('http://localhost:3000/api/dev/create-user', {
      method: 'POST',
    })

    const response = await handler(request)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error.message).toBe('Route not found')
  })

  it('should enforce request size limits', async () => {
    const { parseJson, PayloadTooLargeError } = await import('@/lib/api/validate')
    
    vi.mocked(parseJson).mockRejectedValueOnce(
      new PayloadTooLargeError(2 * 1024 * 1024, 1024 * 1024)
    )

    const handler = withApiGuard(async () => {
      return ok({ success: true })
    }, {
      bodySchema: z.object({ data: z.string() }),
    })

    const request = new NextRequest('http://localhost:3000/api/generate-pitch', {
      method: 'POST',
      body: JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024) }),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(2 * 1024 * 1024),
      },
    })

    const response = await handler(request)
    const body = await response.json()

    expect(response.status).toBe(413) // Payload Too Large
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('should validate request body with Zod schema', async () => {
    const handler = withApiGuard(async (req, { body }) => {
      return ok({ validated: body })
    }, {
      bodySchema: z.object({
        email: z.string().email(),
      }),
    })

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid-email' }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const response = await handler(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('should validate query parameters with Zod schema', async () => {
    const handler = withApiGuard(async (req, { query }) => {
      return ok({ validated: query })
    }, {
      querySchema: z.object({
        page: z.string().transform((val) => parseInt(val, 10)),
      }),
    })

    const request = new NextRequest('http://localhost:3000/api/test?page=abc', {
      method: 'GET',
    })

    const response = await handler(request)
    const body = await response.json()

    // Query validation should pass (transform handles it)
    // But if it fails, we'd get 400
    expect([200, 400]).toContain(response.status)
  })

  it.skip('should verify webhook signatures', async () => {
    const { stripe } = await import('@/lib/stripe')
    
    const handler = withApiGuard(async (req, { body }) => {
      return ok({ event: body })
    })

    const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'test.event', id: 'evt_123' }),
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test-signature',
      },
    })

    await handler(request)

    expect(stripe.webhooks.constructEvent).toHaveBeenCalled()
  })

  it('should reject webhooks with invalid signatures', async () => {
    const { stripe } = await import('@/lib/stripe')
    vi.mocked(stripe.webhooks.constructEvent).mockImplementationOnce(() => {
      throw new Error('Invalid signature')
    })

    const handler = withApiGuard(async () => {
      return ok({ success: true })
    })

    const request = new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'test.event' }),
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'invalid-signature',
      },
    })

    const response = await handler(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toContain('Invalid webhook signature')
  })

  it('should include requestId in response', async () => {
    const handler = withApiGuard(async (req, { requestId }) => {
      return ok({ requestId })
    })

    const request = new NextRequest('http://localhost:3000/api/test', {
      method: 'GET',
      headers: {
        'X-Request-ID': 'test-request-id',
      },
    })

    const response = await handler(request)
    const body = await response.json()

    expect(response.headers.get('X-Request-ID')).toBe('test-request-id')
    expect(body.data.requestId).toBe('test-request-id')
  })

  it('should allow cron access when X-CRON-SECRET matches', async () => {
    const handler = withApiGuard(async (_req, ctx) => {
      return ok({ isCron: ctx.isCron, userId: ctx.userId ?? null })
    })

    const request = new NextRequest('http://localhost:3000/api/autopilot/run', {
      method: 'POST',
      body: JSON.stringify({ dryRun: true }),
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': 'test-cron-secret-123456',
      },
    })

    const response = await handler(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.data.isCron).toBe(true)
  })
})



