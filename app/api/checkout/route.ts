import { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createRouteClient } from '@/lib/supabase/route'
import { serverEnv, clientEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { checkRateLimit, shouldBypassRateLimit, getRateLimitError } from '@/lib/api/ratelimit'
import { validateOrigin } from '@/lib/api/security'

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
  const bridge = createCookieBridge()
  const route = '/api/checkout'
  
  try {
    // Validate origin for state-changing requests
    const originError = validateOrigin(request, route)
    if (originError) {
      return originError
    }
    
    // Check rate limit bypass
    if (!shouldBypassRateLimit(request, route)) {
      // Get user for rate limiting
      const supabase = createRouteClient(request, bridge)
      const { data: { user } } = await supabase.auth.getUser()
      
      // Check rate limit
      const rateLimitResult = await checkRateLimit(
        request,
        user?.id || null,
        route,
        'CHECKOUT'
      )
      
      if (rateLimitResult && !rateLimitResult.success) {
        return getRateLimitError(rateLimitResult, bridge)
      }
    }
    
    // Create Supabase client using the bridge response (cookies will be set on bridge)
    const supabase = createRouteClient(request, bridge)
    
    // Get current user (this may set cookies on bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    // Validate Stripe environment variables
    let priceId: string
    let siteUrl: string
    try {
      const env = validateStripeEnv()
      priceId = env.priceId
      siteUrl = env.siteUrl || request.nextUrl.origin
    } catch (error) {
      return fail(
        ErrorCode.INTERNAL_ERROR,
        'Stripe configuration error',
        undefined,
        undefined,
        bridge
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
        bridge
      )
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
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
        metadata: {
          user_id: user.id,
        },
      },
      allow_promotion_codes: true,
    })

    // Return standardized success response
    return ok({ url: session.url }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/checkout', undefined, bridge)
  }
}
