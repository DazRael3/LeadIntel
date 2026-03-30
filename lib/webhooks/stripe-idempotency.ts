import type { SupabaseClient } from '@supabase/supabase-js'

export type StripeIdempotencyResult = 'first' | 'duplicate' | 'unavailable'

/**
 * Best-effort Stripe webhook idempotency using `api.stripe_webhook_events`.
 *
 * - Uses the service-role client (RLS bypass) so it works in webhook contexts.
 * - Returns:
 *   - 'first' when the event was recorded (process it)
 *   - 'duplicate' when the event already exists (ACK without side effects)
 *   - 'unavailable' when the table does not exist / schema behind (process as before)
 */
export async function recordStripeWebhookEventIfFirst(args: {
  admin: SupabaseClient
  stripeEventId: string
  type: string | null
  livemode: boolean | null
  payload: unknown
}): Promise<StripeIdempotencyResult> {
  const stripeEventId = (args.stripeEventId ?? '').trim()
  if (!stripeEventId) return 'unavailable'

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
      // If the table/column isn't present, fail-soft to previous behavior.
      if (message.includes('schema cache') || message.includes('Could not find') || message.includes('undefined_table')) {
        return 'unavailable'
      }
      // Unknown DB error: do not block webhook processing; treat as unavailable.
      return 'unavailable'
    }

    return 'first'
  } catch {
    // Fail-soft: do not block processing if storage is unavailable.
    return 'unavailable'
  }
}

/**
 * Backwards-compatible helper used by the Stripe webhook route.
 */
export async function shouldProcessStripeEvent(args: {
  supabaseAdmin: SupabaseClient
  stripeEventId: string
  type: string | null
  livemode: boolean | null
  payload: unknown
}): Promise<StripeIdempotencyResult> {
  return recordStripeWebhookEventIfFirst({
    admin: args.supabaseAdmin,
    stripeEventId: args.stripeEventId,
    type: args.type,
    livemode: args.livemode,
    payload: args.payload,
  })
}

