import type Stripe from 'stripe'
import type { CheckoutLineItem } from '@/lib/billing/stripePriceMap'

type StripeErrorLike = {
  type?: unknown
  code?: unknown
  param?: unknown
  requestId?: unknown
  statusCode?: unknown
  decline_code?: unknown
  rawType?: unknown
  message?: unknown
}

function safeStripeErrorDetails(err: unknown) {
  const e: StripeErrorLike = typeof err === 'object' && err !== null ? (err as StripeErrorLike) : {}
  const rawMessage = typeof e.message === 'string' ? e.message : null
  const debugMessage =
    rawMessage && rawMessage.length > 300 ? rawMessage.slice(0, 297) + '...' : rawMessage ? rawMessage : null

  return {
    stripeType: typeof e.type === 'string' ? e.type : null,
    stripeCode: typeof e.code === 'string' ? e.code : null,
    stripeParam: typeof e.param === 'string' ? e.param : null,
    stripeRequestId: typeof e.requestId === 'string' ? e.requestId : null,
    stripeStatusCode: typeof e.statusCode === 'number' ? e.statusCode : null,
    stripeDeclineCode: typeof e.decline_code === 'string' ? e.decline_code : null,
    stripeRawType: typeof e.rawType === 'string' ? e.rawType : null,
    debugMessage,
  } as const
}

export type SubscriptionPriceValidationError =
  | {
      ok: false
      reason: 'non_recurring'
      invalidPrices: Array<{
        priceId: string
        priceType: 'one_time' | 'recurring' | 'unknown'
        active: boolean | null
        recurringInterval: string | null
        recurringIntervalCount: number | null
      }>
    }
  | {
      ok: false
      reason: 'inactive'
      invalidPrices: Array<{
        priceId: string
        priceType: 'one_time' | 'recurring' | 'unknown'
        active: boolean | null
        recurringInterval: string | null
        recurringIntervalCount: number | null
      }>
    }
  | {
      ok: false
      reason: 'stripe_error'
      error: ReturnType<typeof safeStripeErrorDetails>
      priceId: string
    }

export type SubscriptionPriceValidationResult = { ok: true } | SubscriptionPriceValidationError

export async function validateSubscriptionLineItemsAreRecurring(
  stripe: Stripe,
  lineItems: CheckoutLineItem[]
): Promise<SubscriptionPriceValidationResult> {
  const uniquePriceIds = Array.from(
    new Set(
      lineItems
        .map((li) => (typeof li.price === 'string' ? li.price.trim() : ''))
        .filter((id) => id.length > 0)
    )
  )

  const invalid: Array<{
    priceId: string
    priceType: 'one_time' | 'recurring' | 'unknown'
    active: boolean | null
    recurringInterval: string | null
    recurringIntervalCount: number | null
  }> = []

  for (const priceId of uniquePriceIds) {
    let price: Stripe.Price
    try {
      price = await stripe.prices.retrieve(priceId)
    } catch (err) {
      return { ok: false, reason: 'stripe_error', error: safeStripeErrorDetails(err), priceId }
    }

    const priceType =
      typeof price.type === 'string' && (price.type === 'recurring' || price.type === 'one_time')
        ? price.type
        : 'unknown'
    const active = typeof price.active === 'boolean' ? price.active : null
    const recurringInterval = price.recurring?.interval ?? null
    const recurringIntervalCount = typeof price.recurring?.interval_count === 'number' ? price.recurring.interval_count : null

    if (active === false) {
      invalid.push({ priceId, priceType, active, recurringInterval, recurringIntervalCount })
      continue
    }

    if (priceType !== 'recurring') {
      invalid.push({ priceId, priceType, active, recurringInterval, recurringIntervalCount })
    }
  }

  if (invalid.length > 0) {
    const hasInactive = invalid.some((p) => p.active === false)
    return { ok: false, reason: hasInactive ? 'inactive' : 'non_recurring', invalidPrices: invalid }
  }

  return { ok: true }
}

