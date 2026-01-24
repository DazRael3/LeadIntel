import { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createRouteClient } from '@/lib/supabase/route'
import { serverEnv, clientEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'
import { z } from 'zod'
import { readBodyWithLimit } from '@/lib/api/validate'
import { captureMessage } from '@/lib/observability/sentry'

/**
 * Validates required Stripe environment variables
 * @throws Error with clear message if validation fails
 */
function validateStripeEnv(): { priceId: string; siteUrl: string } {
  // STRIPE_SECRET_KEY is already validated in lib/stripe.ts via serverEnv

  // Validate STRIPE_PRICE_ID (accept STRIPE_PRICE_ID_PRO as override)
  const priceId = serverEnv.STRIPE_PRICE_ID_PRO || serverEnv.STRIPE_PRICE_ID
  
  if (!priceId) {
    throw new Error('STRIPE_PRICE_ID or STRIPE_PRICE_ID_PRO must be set')
  }
  
  if (!priceId.startsWith('price_')) {
    const prefix = priceId.substring(0, Math.min(8, priceId.length))
    throw new Error(`Invalid STRIPE_PRICE_ID. Expected price_... but got ${prefix}...`)
  }

  // Get site URL (optional, defaults to request origin)
  const siteUrl = clientEnv.NEXT_PUBLIC_SITE_URL || ''

  return { priceId, siteUrl }
}

export async function POST(request: NextRequest) {
  return POST_GUARDED(request)
}

export async function GET(_request: NextRequest) {
  // Explicitly return JSON (not Next.js default 404) so callers get a clear signal.
  return fail(
    'METHOD_NOT_ALLOWED',
    'Method not allowed. Use POST /api/checkout.',
    undefined,
    { status: 405 }
  )
}

const CheckoutBodySchema = z.object({
  planId: z.literal('pro'),
})

const POST_GUARDED = withApiGuard(
  async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    // Parse + validate body here (not in guard) so we can return route-specific error codes.
    // Also enforces an explicit 32KB limit.
    let parsedBody: z.infer<typeof CheckoutBodySchema>
    try {
      const raw = await readBodyWithLimit(request, 32768)
      if (!raw || raw.trim().length === 0) {
        return fail(
          'INVALID_CHECKOUT_PAYLOAD',
          'Missing JSON body',
          { hint: 'Send JSON like { "planId": "pro" }' },
          { status: 400 },
          bridge,
          requestId
        )
      }
      const json = JSON.parse(raw)
      const result = CheckoutBodySchema.safeParse(json)
      if (!result.success) {
        return fail(
          'INVALID_CHECKOUT_PAYLOAD',
          'Invalid checkout payload',
          result.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message, code: e.code })),
          { status: 422 },
          bridge,
          requestId
        )
      }
      parsedBody = result.data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JSON body'
      return fail(
        'INVALID_CHECKOUT_PAYLOAD',
        message.startsWith('Invalid JSON') ? message : 'Invalid JSON body',
        undefined,
        { status: 400 },
        bridge,
        requestId
      )
    }

    // Dev-only breadcrumb logging (no secrets).
    if (serverEnv.NODE_ENV === 'development') {
      console.log('[checkout] Request received', {
        requestId,
        planId: parsedBody.planId,
        hasStripeSecretKey: Boolean(serverEnv.STRIPE_SECRET_KEY),
        hasStripePriceId: Boolean(serverEnv.STRIPE_PRICE_ID || serverEnv.STRIPE_PRICE_ID_PRO),
        hasTrialFeePriceId: Boolean(serverEnv.STRIPE_TRIAL_FEE_PRICE_ID),
      })
    }

    // Create Supabase client using the bridge response (cookies will be set on bridge)
    const supabase = createRouteClient(request, bridge)
    
    // Get current user (this may set cookies on bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    // Validate Stripe environment variables
    let priceId: string
    let trialFeePriceId: string | null = null
    let siteUrl: string
    try {
      const env = validateStripeEnv()
      // IMPORTANT: Do not accept price IDs from the client. Always map from server-side plan definition.
      priceId = env.priceId
      siteUrl = env.siteUrl || request.nextUrl.origin

      // Require an explicit trial fee price for "7-day $25 trial" behavior.
      trialFeePriceId = serverEnv.STRIPE_TRIAL_FEE_PRICE_ID || null
      if (!trialFeePriceId) {
        captureMessage('checkout_not_configured_missing_trial_fee_price', {
          route: '/api/checkout',
          requestId,
        })
        return fail(
          'CHECKOUT_NOT_CONFIGURED',
          'Checkout is not configured',
          {
            message: 'STRIPE_TRIAL_FEE_PRICE_ID must be set to enable the $25 trial fee.',
            required: ['STRIPE_TRIAL_FEE_PRICE_ID'],
          },
          { status: 500 },
          bridge,
          requestId
        )
      }
    } catch (error) {
      captureMessage('checkout_not_configured', {
        route: '/api/checkout',
        requestId,
      })
      return fail(
        'CHECKOUT_NOT_CONFIGURED',
        'Checkout is not configured',
        {
          // Do not leak env values; just explain what is missing.
          message: error instanceof Error ? error.message : 'Missing Stripe configuration',
          required: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID (or STRIPE_PRICE_ID_PRO)', 'NEXT_PUBLIC_SITE_URL (recommended)'],
        },
        { status: 500 },
        bridge,
        requestId
      )
    }

    // Check if user already has a Stripe customer ID
    let { data: userData } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = userData?.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // Update user in database
      await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          stripe_customer_id: customerId,
        })
    }

    // Check for existing active subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (existingSubscription) {
      return fail(
        ErrorCode.CONFLICT,
        'Already subscribed',
        undefined,
        undefined,
        bridge,
        requestId
      )
    }

    // Create checkout session
    let sessionUrl: string | null = null
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        // Collect payment method up-front during trial so the trial can convert.
        payment_method_collection: 'always',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${siteUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/pricing`,
        client_reference_id: user.id,
        metadata: {
          user_id: user.id,
          email: user.email ?? '',
        },
        subscription_data: {
          // 7-day trial period
          trial_period_days: 7,
          // $25 trial fee (charged immediately as an invoice item)
          add_invoice_items: trialFeePriceId ? [{ price: trialFeePriceId }] : undefined,
          metadata: {
            user_id: user.id,
          },
        },
        allow_promotion_codes: true,
      })
      sessionUrl = session.url ?? null
    } catch (err) {
      const details =
        serverEnv.NODE_ENV === 'development'
          ? { message: err instanceof Error ? err.message : String(err) }
          : undefined
      return fail(
        ErrorCode.EXTERNAL_API_ERROR,
        'Stripe checkout session creation failed',
        details,
        { status: 500 },
        bridge,
        requestId
      )
    }

    // Return standardized success response
    if (!sessionUrl) {
      return fail(
        ErrorCode.INTERNAL_ERROR,
        'Stripe checkout session missing redirect URL',
        undefined,
        { status: 500 },
        bridge,
        requestId
      )
    }

    return ok({ url: sessionUrl }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/checkout', undefined, bridge, requestId)
  }
},
  // No bodySchema: we validate body inside handler for custom error codes.
)
