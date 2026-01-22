/**
 * API Guard Wrapper
 * 
 * Centralized security enforcement for all API routes.
 * Enforces policies in order:
 * 1. Dev-only check (block in production)
 * 2. Origin enforcement (for state-changing methods, except webhooks)
 * 3. Rate limiting (auth key if userId else ip key)
 * 4. Request size limit (before parsing JSON)
 * 5. Zod validation (route supplies schema)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodTypeAny } from 'zod'
import { getRoutePolicy } from './policy'
import { validateOrigin } from './security'
import { checkRateLimit, getRateLimitError } from './ratelimit'
import { checkPolicyRateLimit, type PolicyRateLimitResult, RedisNotConfiguredError } from './ratelimit-policy'
import { parseJson, PayloadTooLargeError, validationError } from './validate'
import { fail, ErrorCode, createCookieBridge } from './http'
import { getRequestId } from './with-request-id'
import { createRouteClient } from '@/lib/supabase/route'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { serverEnv } from '@/lib/env'
import { timingSafeEqualAscii, verifyCronToken } from '@/lib/api/cron-auth'
import { recordCounter } from '@/lib/observability/metrics'

/**
 * Options for withApiGuard
 */
export interface GuardOptions {
  /** Optional policy name override (uses route pathname by default) */
  policyName?: string
  /** Optional Zod schema for request body validation */
  bodySchema?: ZodTypeAny
  /** Optional Zod schema for query parameter validation */
  querySchema?: ZodTypeAny
  /** Whether to bypass rate limiting (for internal routes) */
  bypassRateLimit?: boolean
  /** Custom webhook signature verification function */
  verifyWebhookSignature?: (args: { request: NextRequest; rawBody: Buffer }) => Promise<boolean>
}

/**
 * Guarded route handler type
 */
type GuardedHandler = (
  request: NextRequest,
  context: {
    body?: unknown
    query?: unknown
    userId?: string
    isCron: boolean
    requestId: string
  }
) => Promise<NextResponse>

/**
 * Wraps an API route handler with security guards
 * 
 * @param handler - Route handler function
 * @param options - Guard options
 * @returns Wrapped handler with security enforcement
 * 
 * @example
 * export const POST = withApiGuard(async (request, { body, userId, requestId }) => {
 *   const data = body as MySchemaType
 *   // ... handler logic
 * }, { bodySchema: MySchema })
 */
export function withApiGuard(
  handler: GuardedHandler,
  options: GuardOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    const bridge = createCookieBridge()
    const method = request.method
    const pathname = new URL(request.url).pathname
    const requestId = getRequestId(request)
    
    // Get route policy
    const policyName = options.policyName || pathname
    const policy = getRoutePolicy(policyName, method)
    const isCron = isCronRequest(request, policy)

    // 1. Dev-only check (block in production, require x-dev-key header in dev)
    if (policy.devOnly) {
      if (serverEnv.NODE_ENV === 'production') {
        return fail(
          ErrorCode.NOT_FOUND,
          'Route not found',
          undefined,
          { status: 404 },
          bridge,
          requestId
        )
      }

      const devKey = request.headers.get('x-dev-key')
      const expectedDevKey = serverEnv.DEV_SEED_SECRET
      if (!devKey || devKey !== expectedDevKey) {
        return fail(
          ErrorCode.UNAUTHORIZED,
          'Missing or invalid x-dev-key header',
          undefined,
          undefined,
          bridge,
          requestId
        )
      }
    }

    // 2. Origin enforcement (for state-changing methods, except webhooks)
    if (policy.originRequired && method !== 'GET') {
      const originError = validateOrigin(request, pathname)
      if (originError) {
        // Add requestId to error response
        const errorBody = await originError.json()
        if (errorBody && typeof errorBody === 'object' && 'error' in errorBody) {
          (errorBody.error as { requestId?: string }).requestId = requestId
        }
        originError.headers.set('X-Request-ID', requestId)
        return originError
      }
    }

    // 3. Authentication enforcement (if required)
    let userId: string | undefined = undefined
    if (policy.authRequired && !isCron) {
      const supabase = createRouteClient(request, bridge)
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        return fail(
          ErrorCode.UNAUTHORIZED,
          'Authentication required',
          undefined,
          undefined,
          bridge,
          requestId
        )
      }
      
      userId = user.id
    }

    // 4. Webhook signature verification (if required, must happen BEFORE reading body)
    // Note: For webhooks, we need to read raw body for signature verification
    // This happens before rate limiting to fail fast on invalid signatures
    // IMPORTANT: Once we read arrayBuffer(), we cannot read the body again
    // So we store it for later JSON parsing if signature is valid
    let rawBodyForWebhook: Buffer | null = null
    let webhookBody: unknown = null
    
    if (policy.webhookSignatureRequired) {
      // Read raw body once for signature verification
      rawBodyForWebhook = Buffer.from(await request.arrayBuffer())
      if (options.verifyWebhookSignature) {
        const isValid = await options.verifyWebhookSignature({ request, rawBody: rawBodyForWebhook })
        if (!isValid) {
          return fail(
            ErrorCode.VALIDATION_ERROR,
            'Invalid webhook signature',
            undefined,
            undefined,
            bridge,
            requestId
          )
        }
        // Parse body after verification
        try {
          webhookBody = JSON.parse(rawBodyForWebhook.toString('utf-8'))
        } catch (err) {
          return fail(
            ErrorCode.VALIDATION_ERROR,
            'Invalid JSON in webhook body',
            undefined,
            undefined,
            bridge,
            requestId
          )
        }
      } else {
        // Default Stripe webhook verification
        try {
          const signature = request.headers.get('stripe-signature')
          if (!signature) {
            return fail(
              ErrorCode.VALIDATION_ERROR,
              'Missing webhook signature header',
              undefined,
              undefined,
              bridge,
              requestId
            )
          }
          // Lazy access to serverEnv to avoid module load-time evaluation in tests
          let webhookSecret: string
          try {
            if (typeof window !== 'undefined') {
              throw new Error('serverEnv cannot be accessed in client code')
            }
            // Dynamic require for lazy evaluation (server-only)
            // In test environments, vi.mock handles this
            let envModule
            try {
              envModule = require('@/lib/env')
            } catch {
              // Fallback for test environments where path aliases may not resolve
              envModule = require('../env')
            }
            webhookSecret = envModule.serverEnv.STRIPE_WEBHOOK_SECRET
          } catch (requireErr) {
            // In test environments, env might not be available
            throw new Error('Webhook secret not configured')
          }
          // Verify signature (this will throw if invalid)
          // This also parses the event, but we'll use the parsed body for handler
          stripe.webhooks.constructEvent(rawBodyForWebhook, signature, webhookSecret)
          // Parse body after verification
          webhookBody = JSON.parse(rawBodyForWebhook.toString('utf-8'))
        } catch (err) {
          return fail(
            ErrorCode.VALIDATION_ERROR,
            'Invalid webhook signature',
            { details: err instanceof Error ? err.message : 'Unknown error' },
            undefined,
            bridge,
            requestId
          )
        }
      }
    }

    // 5. Rate limiting using policy-defined limits
    if (!options.bypassRateLimit) {
      // Get user for rate limiting (if not already fetched during auth check)
      if (!policy.authRequired && !isCron) {
        const supabase = createRouteClient(request, bridge)
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id || undefined
      }

      // Check rate limit using policy-defined limits directly
      try {
        const rateLimitResult = await checkPolicyRateLimit(
          request,
          userId ?? null,
          pathname,
          policy
        )

        // In development, rateLimitResult may be null if Redis is not configured (allowed)
        // In production, checkPolicyRateLimit throws RedisNotConfiguredError if Redis is missing
        if (rateLimitResult && !rateLimitResult.success) {
          recordCounter('ratelimit.block', 1, {
            route: pathname,
            auth: userId ? '1' : '0',
          })
          // Convert PolicyRateLimitResult to RateLimitResult for getRateLimitError
          const standardResult = {
            success: false,
            limit: rateLimitResult.limit,
            remaining: rateLimitResult.remaining,
            reset: rateLimitResult.reset,
          }
          const errorResponse = getRateLimitError(standardResult, bridge, requestId)
          // Add policy-defined limit headers (may differ from actual limit used)
          errorResponse.headers.set('X-RateLimit-Limit', String(policy.rateLimit.authPerMin))
          errorResponse.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining))
          return errorResponse
        }
      } catch (error) {
        // In production, if Redis is not configured, return 503
        if (error instanceof RedisNotConfiguredError) {
          return fail(
            ErrorCode.SERVICE_UNAVAILABLE,
            error.message,
            { details: 'Rate limiting service is not available. Please check server configuration.' },
            { status: 503 },
            bridge,
            requestId
          )
        }
        // Re-throw other errors
        throw error
      }
    }

    // 6. Request size limit and JSON parsing (only for methods with bodies)
    // Note: For webhooks, body was already read and parsed during signature verification
    let body: unknown = undefined
    if (method !== 'GET' && method !== 'HEAD' && policy.maxBytes > 0) {
      if (webhookBody !== null) {
        // For webhooks, use already-parsed body from signature verification
        body = webhookBody
      } else {
        // For normal requests, parse from request
        try {
          body = await parseJson(request, { maxBytes: policy.maxBytes })
        } catch (err) {
          if (err instanceof PayloadTooLargeError) {
            return validationError(err, bridge, requestId)
          }
          // Re-throw other errors (invalid JSON, etc.)
          return validationError(err, bridge, requestId)
        }
      }
    }

    // 7. Query parameter validation (if schema provided)
    let query: unknown = undefined
    if (options.querySchema) {
      try {
        const { searchParams } = new URL(request.url)
        const queryObj: Record<string, string | string[]> = {}
        searchParams.forEach((value, key) => {
          if (queryObj[key]) {
            const existing = queryObj[key]
            if (Array.isArray(existing)) {
              existing.push(value)
            } else {
              queryObj[key] = [existing as string, value]
            }
          } else {
            queryObj[key] = value
          }
        })
        query = options.querySchema.parse(queryObj)
      } catch (err) {
        return validationError(err, bridge, requestId)
      }
    }

    // 8. Body validation (if schema provided)
    if (options.bodySchema && body !== undefined) {
      try {
        body = options.bodySchema.parse(body)
      } catch (err) {
        return validationError(err, bridge, requestId)
      }
    }

    // userId is already set from auth check above (or undefined if auth not required)

    // Call handler with validated data
    try {
      const response = await handler(request, {
        body,
        query,
        userId,
        isCron,
        requestId,
      })
      
      // Ensure handler returned a valid Response object
      if (!response || !(response instanceof Response)) {
        return fail(
          ErrorCode.INTERNAL_ERROR,
          'Handler did not return a valid response',
          undefined,
          undefined,
          bridge,
          requestId
        )
      }
      
      const nextResponse = response
      
      if (!nextResponse.headers.get('X-Request-ID')) {
        nextResponse.headers.set('X-Request-ID', requestId)
      }
      
      if (!options.bypassRateLimit) {
        const isAuthenticated = !!userId
        const limitToShow = isAuthenticated 
          ? policy.rateLimit.authPerMin 
          : policy.rateLimit.ipPerMin
        
        nextResponse.headers.set('X-RateLimit-Limit', String(limitToShow))
      }
      
      return nextResponse
    } catch (err) {
      // Handler errors should be caught and handled by the handler itself
      // But if they bubble up, return standardized error
      const errorMessage = err instanceof Error ? err.message : 'Internal server error'
      return fail(
        ErrorCode.INTERNAL_ERROR,
        errorMessage,
        undefined,
        undefined,
        bridge,
        requestId
      )
    }
  }
}

function isCronRequest(request: NextRequest, policy: { cronAllowed: boolean }): boolean {
  if (!policy.cronAllowed) return false
  const url = new URL(request.url)

  // 1) Legacy: custom header (may be unavailable in some cron providers)
  const providedHeader = request.headers.get('x-cron-secret')
  const expectedHeader = serverEnv.CRON_SECRET
  if (providedHeader && expectedHeader && timingSafeEqualAscii(providedHeader, expectedHeader)) {
    return true
  }

  // 2) Preferred: signed query token (works even if custom headers are stripped)
  const cronToken = url.searchParams.get('cron_token')
  const signingSecret = serverEnv.CRON_SIGNING_SECRET
  if (cronToken && signingSecret) {
    return verifyCronToken({
      signingSecret,
      providedToken: cronToken,
      ctx: { method: request.method, pathname: url.pathname },
    })
  }

  return false
}
