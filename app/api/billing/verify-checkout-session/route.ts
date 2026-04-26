import { NextRequest } from 'next/server'
import { z } from 'zod'
import Stripe from 'stripe'

import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/observability/logger'
import { assertProdStripeConfig } from '@/lib/config/runtimeEnv'
import { productPlanForTier } from '@/lib/billing/product-plan'
import { resolveUserSubscriptionTierFromStripe } from '@/lib/billing/stripe-subscription-tier'

export const dynamic = 'force-dynamic'

const VerifyQuerySchema = z.object({
  session_id: z.string().trim().min(10),
})

function truncateSessionId(id: string): string {
  const s = id.trim()
  if (s.length <= 12) return s
  return `${s.slice(0, 12)}…`
}

function getStripeMode(): 'live' | 'test' {
  return serverEnv.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test'
}

export const GET = withApiGuard(
  async (request: NextRequest, { query, requestId, userId }) => {
    const bridge = createCookieBridge()
    const stripeMode = getStripeMode()

    try {
      const { session_id } = query as z.infer<typeof VerifyQuerySchema>
      // Production safety: block accidental Stripe test keys.
      // (No effect in dev/staging; enforced only when NEXT_PUBLIC_APP_ENV === "production".)
      assertProdStripeConfig()

      // Auth is enforced by withApiGuard via lib/api/policy.ts (GET:/api/billing/verify-checkout-session authRequired: true).
      // This guard is defensive for unexpected misconfiguration.
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      // Verify session against Stripe server-side.
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ['subscription', 'customer'],
      })

      // Safety: ensure this session belongs to the currently authenticated user.
      const ref = typeof session.client_reference_id === 'string' ? session.client_reference_id : null
      const metaUserId = typeof session.metadata?.user_id === 'string' ? session.metadata.user_id : null
      if (ref !== userId && metaUserId !== userId) {
        logger.warn({
          level: 'warn',
          scope: 'checkout',
          message: 'session.verify_failed',
          reason: 'user_mismatch',
          userId,
          sessionId: truncateSessionId(session_id),
          stripeMode,
        })
        return fail(ErrorCode.FORBIDDEN, 'Forbidden', undefined, undefined, bridge, requestId)
      }

      // Determine price id (line items are not included on retrieve; fetch separately).
      let priceId: string | null = null
      try {
        const li = await stripe.checkout.sessions.listLineItems(session_id, { limit: 5 })
        const first = li.data[0]
        const p = first?.price
        priceId = typeof p?.id === 'string' && p.id.length > 0 ? p.id : null
      } catch {
        // fail-open: we'll still attempt to use subscription items if expanded.
      }

      const sub = session.subscription
      const subscriptionId = typeof sub === 'string' ? sub : sub?.id ?? null
      let subscription = typeof sub === 'object' && sub !== null ? (sub as Stripe.Subscription) : null
      if (!subscription && subscriptionId) {
        try {
          subscription = await stripe.subscriptions.retrieve(subscriptionId)
        } catch (subscriptionError) {
          logger.warn({
            level: 'warn',
            scope: 'checkout',
            message: 'session.subscription_retrieve_failed',
            sessionId: truncateSessionId(session_id),
            stripeMode,
            error: subscriptionError instanceof Error ? subscriptionError.message : String(subscriptionError),
          })
        }
      }
      const status = subscription?.status ?? null

      // If we couldn't get a line item price id, derive from expanded subscription items (best-effort).
      if (!priceId && subscription?.items?.data?.[0]?.price?.id) {
        priceId = subscription.items.data[0].price.id
      }

      // If session isn’t in a paid/complete state, report pending without mutating DB.
      const isPaid = session.payment_status === 'paid' || session.status === 'complete'
      if (!isPaid) {
        return ok({ verified: false, plan: 'free' as const }, undefined, bridge, requestId)
      }
      if (!subscriptionId || !status) {
        logger.warn({
          level: 'warn',
          scope: 'checkout',
          message: 'session.verify_pending_missing_subscription',
          userId,
          sessionId: truncateSessionId(session_id),
          stripeMode,
        })
        return ok({ verified: false, plan: 'free' as const }, undefined, bridge, requestId)
      }

      // Upsert subscription + mark user as paid (Pro) via service role (RLS-safe).
      // IMPORTANT: Persist billing state in the `api` schema.
      // `/api/plan` resolves tier from `api.subscriptions` + `api.users.subscription_tier`.
      const schema = 'api' as const
      const admin = createSupabaseAdminClient({ schema })

      const resolvedSubscriptionTier = resolveUserSubscriptionTierFromStripe({
        status,
        stripePriceId: priceId,
      })
      const userUpdate = await admin.from('users').update({ subscription_tier: resolvedSubscriptionTier }).eq('id', userId)
      if (userUpdate?.error) {
        throw new Error(
          typeof userUpdate.error.message === 'string' && userUpdate.error.message.length > 0
            ? userUpdate.error.message
            : 'Failed to persist user subscription marker'
        )
      }

      const customer = session.customer
      const customerId = typeof customer === 'string' ? customer : customer?.id ?? null

      // Write the subscription row (fields are best-effort; schema drift tolerated).
      const subPayload = {
        user_id: userId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        status,
        // Keep both `stripe_price_id` and `price_id` for compatibility across migrations.
        current_period_end: subscription?.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
        current_period_start: subscription?.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
        trial_end: subscription?.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        stripe_price_id: priceId,
        price_id: priceId,
      }

      const subUpsert = await admin
        .from('subscriptions')
        .upsert(subPayload, { onConflict: 'stripe_subscription_id' })
      if (subUpsert?.error) {
        throw new Error(
          typeof subUpsert.error.message === 'string' && subUpsert.error.message.length > 0
            ? subUpsert.error.message
            : 'Failed to persist subscription row'
        )
      }

      if (resolvedSubscriptionTier === 'free') {
        return ok({ verified: false, plan: 'free' as const }, undefined, bridge, requestId)
      }

      const tier = resolvedSubscriptionTier === 'team' ? 'team' : resolvedSubscriptionTier === 'closer_plus' ? 'closer_plus' : 'closer'
      const planId = resolvedSubscriptionTier === 'team' ? 'team' : resolvedSubscriptionTier === 'closer_plus' ? 'closer_plus' : 'pro'

      logger.info({
        level: 'info',
        scope: 'checkout',
        message: 'session.persisted',
        userId,
        planId,
        tier,
        schema,
        requestId,
      })

      logger.info({
        level: 'info',
        scope: 'checkout',
        message: 'session.verified',
        planId,
        tier,
        stripeMode,
        sessionId: truncateSessionId(session_id),
      })

      return ok(
        { verified: true, plan: productPlanForTier(tier), tier, planId },
        undefined,
        bridge,
        requestId
      )
    } catch (error) {
      logger.error({
        level: 'error',
        scope: 'checkout',
        message: 'session.verify_failed',
        stripeMode,
        error: error instanceof Error ? error.message : String(error),
      })
      return asHttpError(error, '/api/billing/verify-checkout-session', undefined, bridge, requestId)
    }
  },
  { querySchema: VerifyQuerySchema }
)

