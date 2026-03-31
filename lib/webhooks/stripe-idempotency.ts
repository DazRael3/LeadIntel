import type { SupabaseClient } from '@supabase/supabase-js'

export type StripeIdempotencyResult = 'first' | 'duplicate'

/**
 * Stripe webhook idempotency using `api.stripe_webhook_events`.
 *
 * - Uses the service-role client (RLS bypass) so it works in webhook contexts.
 * - Returns:
 *   - 'first' when the event was recorded (process it)
 *   - 'duplicate' when the event already exists (ACK without side effects)
 */
export async function recordStripeWebhookEventIfFirst(args: {
  admin: SupabaseClient
  stripeEventId: string
  type: string | null
  livemode: boolean | null
  payload: unknown
}): Promise<StripeIdempotencyResult> {
  const stripeEventId = (args.stripeEventId ?? '').trim()
  if (!stripeEventId) {
    const err = new Error('Missing Stripe event id')
    err.name = 'StripeIdempotencyError'
    throw err
  }

  try {
    const { error } = await args.admin
      .schema('api')
      .from('stripe_webhook_events')
      .insert({
        stripe_event_id: stripeEventId,
        type: args.type ?? null,
        livemode: typeof args.livemode === 'boolean' ? args.livemode : null,
        payload: args.payload ?? {},
        processed_at: null,
        error: null,
      })

    // Duplicate if unique constraint hits.
    if (error) {
      const msg = (error as { message?: unknown } | null)?.message
      const message = typeof msg === 'string' ? msg : ''
      if (message.toLowerCase().includes('duplicate key') || message.toLowerCase().includes('unique')) {
        return 'duplicate'
      }
      const err = new Error('Stripe webhook idempotency insert failed')
      err.name = 'StripeIdempotencyUnavailable'
      throw err
    }

    return 'first'
  } catch {
    const err = new Error('Stripe webhook idempotency unavailable')
    err.name = 'StripeIdempotencyUnavailable'
    throw err
  }
}

// NOTE: Do not provide a fail-open API here; idempotency is required for Stripe webhooks.

