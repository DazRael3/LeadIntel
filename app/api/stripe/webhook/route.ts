import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { serverEnv, clientEnv } from '@/lib/env'
import { ok, fail, ErrorCode } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'
import { captureBreadcrumb, captureException, captureMessage } from '@/lib/observability/sentry'
import { isFeatureEnabled } from '@/lib/services/feature-flags'
import { recordCounter } from '@/lib/observability/metrics'

/**
 * Stripe Webhook Handler
 * 
 * Verifies Stripe webhook signatures and updates user subscription status.
 * Uses Supabase service role key for admin operations.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = withApiGuard(
  async (request, { body, requestId }) => {
    // Guard already verified signature and parsed body
    // Body is the parsed Stripe event object
    const event = body as Stripe.Event
    recordCounter('webhook.stripe.total', 1)

    captureBreadcrumb({
      category: 'webhook',
      level: 'info',
      message: 'stripe_webhook_received',
      data: {
        route: '/api/stripe/webhook',
        requestId,
        eventType: event.type,
        livemode: (event as any).livemode ?? undefined,
      },
    })

    if (!isFeatureEnabled('stripe_webhook')) {
      captureBreadcrumb({
        category: 'feature_flag',
        level: 'warning',
        message: 'stripe_webhook_disabled',
        data: { route: '/api/stripe/webhook', requestId, eventType: event.type },
      })
      // ACK to prevent retry storms; operators can re-enable to resume processing.
      return ok({ received: true, disabled: true }, undefined, undefined, requestId)
    }

    // Create Supabase admin client for subscription updates
    const supabaseAdmin = createClient(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      serverEnv.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        if (session.mode === 'subscription' && session.customer) {
          const customerId = typeof session.customer === 'string' 
            ? session.customer 
            : session.customer.id

          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          
          // Update user subscription
          const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
              subscription_tier: 'pro',
              stripe_customer_id: customerId,
            })
            .eq('stripe_customer_id', customerId)

          if (updateError) {
            console.error('Error updating user subscription:', updateError)
            recordCounter('webhook.stripe.error', 1, { stage: 'update_user' })
            captureException(updateError, { route: '/api/stripe/webhook', requestId, eventType: event.type })
            return fail(
              ErrorCode.DATABASE_ERROR,
              'Failed to update subscription',
              undefined,
              undefined,
              undefined,
              requestId
            )
          }

          // Upsert subscription record
          const { error: subError } = await supabaseAdmin
            .from('subscriptions')
            .upsert({
              user_id: session.client_reference_id || null,
              stripe_subscription_id: subscription.id,
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
            }, {
              onConflict: 'stripe_subscription_id'
            })

          if (subError) {
            console.error('Error upserting subscription:', subError)
            recordCounter('webhook.stripe.error', 1, { stage: 'upsert_subscription' })
            captureException(subError, { route: '/api/stripe/webhook', requestId, eventType: event.type })
          }
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        if (subscription.customer) {
          const customerId = typeof subscription.customer === 'string' 
            ? subscription.customer 
            : subscription.customer.id

          // Update subscription record
          const { error: subError } = await supabaseAdmin
            .from('subscriptions')
            .upsert({
              stripe_subscription_id: subscription.id,
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
            }, {
              onConflict: 'stripe_subscription_id'
            })

          if (subError) {
            console.error('Error updating subscription:', subError)
            recordCounter('webhook.stripe.error', 1, { stage: 'update_subscription' })
            captureException(subError, { route: '/api/stripe/webhook', requestId, eventType: event.type })
          }

          // Update user tier based on subscription status
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            await supabaseAdmin
              .from('users')
              .update({ subscription_tier: 'pro' })
              .eq('stripe_customer_id', customerId)
          } else {
            await supabaseAdmin
              .from('users')
              .update({ subscription_tier: 'free' })
              .eq('stripe_customer_id', customerId)
          }
        }
        break
      }

      default:
        // Unhandled event type
        console.log(`Unhandled event type: ${event.type}`)
        captureMessage('stripe_webhook_unhandled_event', { route: '/api/stripe/webhook', requestId, eventType: event.type })
    }

    return ok({ received: true }, undefined, undefined, requestId)
  },
  {
    // Webhook signature verification is handled by guard
    bypassRateLimit: false, // Rate limit is DoS backstop only
  }
)
