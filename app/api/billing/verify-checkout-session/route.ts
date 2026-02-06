import { NextRequest } from 'next/server'
import { z } from 'zod'
import Stripe from 'stripe'

import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { stripe } from '@/lib/stripe'
import { logger } from '@/lib/observability/logger'

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

function configuredProPriceId(): string | null {
  const v = (serverEnv.STRIPE_PRICE_ID_PRO || serverEnv.STRIPE_PRICE_ID || '').trim()
  return v.length > 0 ? v : null
}

export const GET = withApiGuard(
  async (request: NextRequest, { query, requestId }) => {
    const bridge = createCookieBridge()
    const stripeMode = getStripeMode()

    try {
      const { session_id } = query as z.infer<typeof VerifyQuerySchema>

      const supabase = createRouteClient(request, bridge)
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      // Verify session against Stripe server-side.
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ['subscription', 'customer'],
      })

      // Safety: ensure this session belongs to the currently authenticated user.
      const ref = typeof session.client_reference_id === 'string' ? session.client_reference_id : null
      const metaUserId = typeof session.metadata?.user_id === 'string' ? session.metadata.user_id : null
      if (ref !== user.id && metaUserId !== user.id) {
        logger.warn({
          level: 'warn',
          scope: 'checkout',
          message: 'session.verify_failed',
          reason: 'user_mismatch',
          userId: user.id,
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
      const subscription = typeof sub === 'object' && sub !== null ? (sub as Stripe.Subscription) : null
      const status = subscription?.status ?? 'active'

      // If we couldn't get a line item price id, derive from expanded subscription items (best-effort).
      if (!priceId && subscription?.items?.data?.[0]?.price?.id) {
        priceId = subscription.items.data[0].price.id
      }

      // If session isn’t in a paid/complete state, report pending without mutating DB.
      const isPaid = session.payment_status === 'paid' || session.status === 'complete'
      if (!isPaid) {
        return ok({ verified: false, plan: 'free' as const }, undefined, bridge, requestId)
      }

      // Upsert subscription + mark user as paid (Pro) via service role (RLS-safe).
      const admin = createSupabaseAdminClient()

      // Keep app behavior consistent: users table stores free/pro, while tier (closer/team) is inferred from price id.
      await admin.from('users').update({ subscription_tier: 'pro' }).eq('id', user.id)

      const customer = session.customer
      const customerId = typeof customer === 'string' ? customer : customer?.id ?? null

      // Write the subscription row (fields are best-effort; schema drift tolerated).
      await admin
        .from('subscriptions')
        .upsert(
          {
            user_id: user.id,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            status,
            current_period_end: subscription?.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
            current_period_start: subscription?.current_period_start
              ? new Date(subscription.current_period_start * 1000).toISOString()
              : null,
            cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
            trial_end: subscription?.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            stripe_price_id: priceId,
          },
          { onConflict: 'stripe_subscription_id' }
        )

      const proPrice = configuredProPriceId()
      const isTeam = Boolean(priceId && proPrice && priceId !== proPrice)
      const tier = isTeam ? ('team' as const) : ('closer' as const)
      const planId = isTeam ? ('team' as const) : ('pro' as const)

      logger.info({
        level: 'info',
        scope: 'checkout',
        message: 'session.verified',
        planId,
        tier,
        stripeMode,
        sessionId: truncateSessionId(session_id),
      })

      return ok({ verified: true, plan: 'pro' as const, tier, planId }, undefined, bridge, requestId)
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

