import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { serverEnv } from '@/lib/env'
import { ok, fail, ErrorCode } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'
import { captureBreadcrumb, captureException, captureMessage } from '@/lib/observability/sentry'
import { isFeatureEnabled } from '@/lib/services/feature-flags'
import { recordCounter } from '@/lib/observability/metrics'
import { logger } from '@/lib/observability/logger'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { enqueueWebhookEvent } from '@/lib/integrations/webhooks'
import { randomUUID } from 'crypto'
import { getAppUrl } from '@/lib/app-url'
import { renderUpgradeConfirmationEmail } from '@/lib/email/lifecycle'
import { sendEmailDeduped } from '@/lib/email/send-deduped'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { adminNotificationsEnabled, getLifecycleAdminEmails, lifecycleEmailsEnabled } from '@/lib/lifecycle/config'
import { renderAdminNotificationEmail } from '@/lib/email/internal'
import { getResendReplyToEmail } from '@/lib/email/routing'
import { recordStripeWebhookEventIfFirst } from '@/lib/webhooks/stripe-idempotency'
import { resolveUserSubscriptionTierFromStripe } from '@/lib/billing/stripe-subscription-tier'
import { logProductEvent } from '@/lib/services/analytics'

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

    if (!(await isFeatureEnabled('stripe_webhook'))) {
      captureBreadcrumb({
        category: 'feature_flag',
        level: 'warning',
        message: 'stripe_webhook_disabled',
        data: { route: '/api/stripe/webhook', requestId, eventType: event.type },
      })
      // ACK to prevent retry storms; operators can re-enable to resume processing.
      return ok({ received: true, disabled: true }, undefined, undefined, requestId)
    }

    // Create Supabase admin client for subscription updates.
    // IMPORTANT: Always target the `api` schema (never `public`).
    const supabaseAdmin = createSupabaseAdminClient({ schema: 'api' })

    // Idempotency: required dependency. We ACK duplicates to prevent replay side effects.
    // If idempotency persistence is unavailable, we fail safe (500) so Stripe retries
    // rather than processing without replay protection.
    try {
      const processGate = await recordStripeWebhookEventIfFirst({
        admin: supabaseAdmin,
        stripeEventId: event.id,
        type: event.type,
        livemode: Boolean((event as unknown as { livemode?: unknown }).livemode),
        payload: event,
      })
      if (processGate === 'duplicate') {
        recordCounter('webhook.stripe.duplicate', 1)
        return ok({ received: true, duplicate: true }, undefined, undefined, requestId)
      }
    } catch (e) {
      recordCounter('webhook.stripe.error', 1, { stage: 'idempotency_unavailable' })
      captureMessage('stripe_webhook_idempotency_unavailable', { level: 'error' })
      logger.error({
        level: 'error',
        scope: 'stripe_webhook',
        message: 'idempotency_unavailable',
        requestId,
        error: e,
      })
      return fail(
        ErrorCode.INTERNAL_ERROR,
        'Idempotency storage unavailable',
        undefined,
        undefined,
        undefined,
        requestId
      )
    }

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
          
          // Resolve user_id. Prefer client_reference_id (we set it in checkout as the Supabase user id).
          let userId: string | null = typeof session.client_reference_id === 'string' ? session.client_reference_id : null
          if (!userId) {
            // Fallback: look up user by stripe_customer_id (if it was already stored).
            const { data: userRow } = await supabaseAdmin
              .from('users')
              .select('id')
              .eq('stripe_customer_id', customerId)
              .maybeSingle()
            userId = (userRow as { id?: string } | null)?.id ?? null
          }

          // Update user subscription tier and customer id.
          const subscriptionPriceId = subscription.items.data[0]?.price?.id ?? null
          const resolvedSubscriptionTier = resolveUserSubscriptionTierFromStripe({
            status: subscription.status,
            stripePriceId: subscriptionPriceId,
          })
          const userUpdate = {
            subscription_tier: resolvedSubscriptionTier,
            stripe_customer_id: customerId,
          }
          const userUpdateQuery = supabaseAdmin.from('users').update(userUpdate)
          const { error: updateError } = userId
            ? await userUpdateQuery.eq('id', userId)
            : await userUpdateQuery.eq('stripe_customer_id', customerId)

          if (updateError) {
            logger.error({
              level: 'error',
              scope: 'stripe_webhook',
              message: 'update_user_failed',
              requestId,
              error: updateError,
            })
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
              user_id: userId,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: customerId,
              status: subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
              stripe_price_id: subscriptionPriceId,
            }, {
              onConflict: 'stripe_subscription_id'
            })

          if (subError) {
            logger.error({
              level: 'error',
              scope: 'stripe_webhook',
              message: 'upsert_subscription_failed',
              requestId,
              error: subError,
            })
            recordCounter('webhook.stripe.error', 1, { stage: 'upsert_subscription' })
            captureException(subError, { route: '/api/stripe/webhook', requestId, eventType: event.type })
          }

          if (userId) {
            try {
              await logProductEvent({
                userId,
                eventName: 'subscription_created',
                eventProps: {
                  source: 'stripe_webhook',
                  eventType: event.type,
                  status: subscription.status,
                  subscriptionTier: resolvedSubscriptionTier,
                  stripePriceId: subscriptionPriceId,
                  stripeCustomerId: customerId,
                },
              })
            } catch {
              // best-effort
            }
          }

          // Best-effort: send upgrade confirmation email (deduped) + mark lifecycle_state.
          try {
            const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
            const hasResend = Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean(from)
            if (lifecycleEmailsEnabled() && hasResend && userId) {
              const { data: userEmailRow } = await supabaseAdmin.from('users').select('email').eq('id', userId).maybeSingle()
              const toEmail = ((userEmailRow as { email?: string | null } | null)?.email ?? '').trim()
              if (toEmail) {
                const appUrl = getAppUrl()
                const payload = renderUpgradeConfirmationEmail({ appUrl })
                await sendEmailDeduped(supabaseAdmin, {
                  dedupeKey: `lifecycle:upgrade_confirmation:${userId}`,
                  userId,
                  toEmail,
                  fromEmail: from,
                  replyTo: getResendReplyToEmail(),
                  subject: payload.subject,
                  html: payload.html,
                  text: payload.text,
                  kind: 'lifecycle',
                  template: 'upgrade_confirmation',
                  tags: [{ name: 'kind', value: 'lifecycle' }, { name: 'type', value: 'upgrade_confirmation' }],
                  meta: { userId, stripeCustomerId: customerId, stripeSubscriptionId: subscription.id },
                })
                await supabaseAdmin.from('lifecycle_state').upsert({ user_id: userId, upgrade_confirm_sent_at: new Date().toISOString() }, { onConflict: 'user_id' })
              }
            }
          } catch {
            // best-effort only
          }

          // Optional: operator notification (deduped).
          try {
            const admins = getLifecycleAdminEmails()
            const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
            const hasResend = Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean(from)
            if (adminNotificationsEnabled() && admins.length > 0 && hasResend && userId) {
              const appUrl = getAppUrl()
              const email = renderAdminNotificationEmail({
                title: 'Upgrade completed',
                appUrl,
                lines: [
                  `user_id: ${userId}`,
                  `stripe_customer_id: ${customerId}`,
                  `stripe_subscription_id: ${subscription.id}`,
                  `status: ${subscription.status}`,
                ],
              })
              await Promise.allSettled(
                admins.map((toEmail) =>
                  sendEmailDeduped(supabaseAdmin, {
                    dedupeKey: `admin:upgrade:${subscription.id}:${toEmail}`,
                    userId: null,
                    toEmail,
                    fromEmail: from,
                    replyTo: getResendReplyToEmail(),
                    subject: email.subject,
                    html: email.html,
                    text: email.text,
                    kind: 'internal',
                    template: 'admin_upgrade',
                    tags: [{ name: 'kind', value: 'internal' }, { name: 'type', value: 'upgrade' }],
                    meta: { userId, stripeCustomerId: customerId, stripeSubscriptionId: subscription.id, status: subscription.status },
                  })
                )
              )
            }
          } catch {
            // best-effort
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

          // Resolve user id via customer id (best-effort)
          const { data: userRow } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle()
          const userId = (userRow as { id?: string } | null)?.id ?? null

          // Update subscription record
          const { error: subError } = await supabaseAdmin
            .from('subscriptions')
            .upsert({
              user_id: userId,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: customerId,
              status: subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
              stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
            }, {
              onConflict: 'stripe_subscription_id'
            })

          if (subError) {
            logger.error({
              level: 'error',
              scope: 'stripe_webhook',
              message: 'update_subscription_failed',
              requestId,
              error: subError,
            })
            recordCounter('webhook.stripe.error', 1, { stage: 'update_subscription' })
            captureException(subError, { route: '/api/stripe/webhook', requestId, eventType: event.type })
          }

          // Update user tier based on subscription status + Stripe price mapping.
          const resolvedSubscriptionTier = resolveUserSubscriptionTierFromStripe({
            status: subscription.status,
            stripePriceId: subscription.items.data[0]?.price?.id ?? null,
          })
          await supabaseAdmin
            .from('users')
            .update({ subscription_tier: resolvedSubscriptionTier })
            .eq('stripe_customer_id', customerId)

          // Workspace webhooks (best-effort): only emit when we can resolve a workspace.
          if (userId) {
            try {
              const { data: ws } = await supabaseAdmin
                .from('workspaces')
                .select('id')
                .eq('owner_user_id', userId)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle()

              const workspaceId = (ws as { id?: string } | null)?.id ?? null
              if (workspaceId) {
                await enqueueWebhookEvent({
                  workspaceId,
                  eventType: 'billing.subscription_updated',
                  eventId: randomUUID(),
                  payload: {
                    workspaceId,
                    userId,
                    stripeCustomerId: customerId,
                    stripeSubscriptionId: subscription.id,
                    status: subscription.status,
                    priceId: subscription.items.data[0]?.price?.id ?? null,
                    updatedAt: new Date().toISOString(),
                  },
                })
              }
            } catch {
              // best-effort
            }
          }
        }
        break
      }

      default:
        // Unhandled event type
        logger.warn({
          level: 'warn',
          scope: 'stripe_webhook',
          message: 'unhandled_event_type',
          requestId,
          eventType: event.type,
        })
        captureMessage('stripe_webhook_unhandled_event', { route: '/api/stripe/webhook', requestId, eventType: event.type })
    }

    return ok({ received: true }, undefined, undefined, requestId)
  },
  {
    // Webhook signature verification is handled by guard
    bypassRateLimit: false, // Rate limit is DoS backstop only
  }
)
