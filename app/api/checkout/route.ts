import { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createRouteClient } from '@/lib/supabase/route'
import { serverEnv, clientEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'

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

const POST_GUARDED = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    // Create Supabase client using the bridge response (cookies will be set on bridge)
    const supabase = createRouteClient(request, bridge)
    
    // Get current user (this may set cookies on bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
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
    return ok({ url: session.url }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/checkout', undefined, bridge, requestId)
  }
})
