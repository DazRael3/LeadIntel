import { NextRequest, type NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { z } from 'zod'

import { stripe } from '@/lib/stripe'
import { withApiGuard } from '@/lib/api/guard'
import { createCookieBridge, fail, ok } from '@/lib/api/http'
import { readBodyWithLimit } from '@/lib/api/validate'
import { createRouteClient } from '@/lib/supabase/route'
import { logger } from '@/lib/observability/logger'
import { assertProdStripeConfig } from '@/lib/config/runtimeEnv'
import {
  getPriceIdsFromEnv,
  resolveCheckoutLineItems,
  type BillingCycle,
  type CheckoutLineItem,
  type PaidPlanId,
} from '@/lib/billing/stripePriceMap'
import { validateSubscriptionLineItemsAreRecurring } from '@/lib/billing/stripePriceValidation'

type CheckoutErrorCode =
  | 'CHECKOUT_CONFIG_MISSING'
  | 'AUTH_REQUIRED'
  | 'INVALID_CHECKOUT_PAYLOAD'
  | 'UNSUPPORTED_PLAN'
  | 'STRIPE_CUSTOMER_INVALID'
  | 'CHECKOUT_SESSION_CREATE_FAILED'
  | 'INTERNAL_CHECKOUT_ERROR'

type StripeErrorLike = {
  name?: unknown
  message?: unknown
  type?: unknown
  code?: unknown
  param?: unknown
  requestId?: unknown
  statusCode?: unknown
  decline_code?: unknown
  rawType?: unknown
}

type CheckoutErrorDetails = {
  errorName: string | null
  errorMessage: string | null
  stripeType: string | null
  stripeCode: string | null
  stripeParam: string | null
  stripeRequestId: string | null
  stripeStatusCode: number | null
  stripeDeclineCode: string | null
  stripeRawType: string | null
}

const CheckoutBodySchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(['monthly', 'annual']).optional(),
  seats: z.number().int().min(1).max(250).optional(),
})

function validateStripeEnv(): { siteUrl: string; hasStripeSecretKey: boolean } {
  return {
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim(),
    hasStripeSecretKey: Boolean((process.env.STRIPE_SECRET_KEY ?? '').trim()),
  }
}

function getStripeMode(): 'live' | 'test' {
  return (process.env.STRIPE_SECRET_KEY ?? '').trim().startsWith('sk_live_') ? 'live' : 'test'
}

function isDevelopment(): boolean {
  return (process.env.NODE_ENV ?? '').trim() === 'development'
}

function normalizeCheckoutPlanId(rawPlanId: string): PaidPlanId | null {
  const normalized = rawPlanId.trim().toLowerCase()
  if (normalized === 'pro' || normalized === 'closer') return 'pro'
  if (normalized === 'agency' || normalized === 'team') return 'team'
  if (normalized === 'closer_plus') return 'closer_plus'
  return null
}

function resolveSiteUrl(args: { request: NextRequest; configuredSiteUrl: string }): string {
  const configured = args.configuredSiteUrl.trim()
  if (configured) return configured

  const origin = args.request.nextUrl.origin?.trim()
  if (origin) return origin

  if (isDevelopment()) return 'http://localhost:3000'
  return ''
}

function redactStripeId(id: string | null | undefined): string | null {
  if (!id) return null
  if (id.length <= 8) return '[redacted]'
  return `${id.slice(0, 4)}...[redacted]...${id.slice(-4)}`
}

function sanitizeErrorMessage(message: string | null): string | null {
  if (!message) return null
  const redacted = message
    .replace(/\bcus_[A-Za-z0-9]+\b/g, 'cus_[redacted]')
    .replace(/\bsub_[A-Za-z0-9]+\b/g, 'sub_[redacted]')
    .replace(/\bpi_[A-Za-z0-9]+\b/g, 'pi_[redacted]')
  return redacted.length > 280 ? `${redacted.slice(0, 277)}...` : redacted
}

function getCheckoutErrorDetails(error: unknown): CheckoutErrorDetails {
  const err = (typeof error === 'object' && error !== null ? error : {}) as StripeErrorLike
  const rawMessage =
    typeof err.message === 'string' ? err.message : error instanceof Error ? error.message : null

  return {
    errorName: typeof err.name === 'string' ? err.name : error instanceof Error ? error.name : null,
    errorMessage: sanitizeErrorMessage(rawMessage),
    stripeType: typeof err.type === 'string' ? err.type : null,
    stripeCode: typeof err.code === 'string' ? err.code : null,
    stripeParam: typeof err.param === 'string' ? err.param : null,
    stripeRequestId: typeof err.requestId === 'string' ? err.requestId : null,
    stripeStatusCode: typeof err.statusCode === 'number' ? err.statusCode : null,
    stripeDeclineCode: typeof err.decline_code === 'string' ? err.decline_code : null,
    stripeRawType: typeof err.rawType === 'string' ? err.rawType : null,
  }
}

function isStripeMissingCustomerError(details: CheckoutErrorDetails): boolean {
  if (details.stripeCode === 'resource_missing' && details.stripeParam === 'customer') return true
  const message = (details.errorMessage ?? '').toLowerCase()
  return message.includes('no such customer')
}

function selectedPriceEnvVarNames(args: {
  planId: PaidPlanId
  billingCycle: BillingCycle
  lineItems: CheckoutLineItem[]
}): string[] {
  const prices = getPriceIdsFromEnv()
  const valueToNames = new Map<string, string[]>()
  const add = (name: string, value: string | null) => {
    if (!value) return
    const existing = valueToNames.get(value) ?? []
    existing.push(name)
    valueToNames.set(value, existing)
  }

  add('STRIPE_PRICE_ID_PRO', prices.closerMonthly)
  add('STRIPE_PRICE_ID', prices.closerMonthly)
  add('STRIPE_PRICE_ID_CLOSER_ANNUAL', prices.closerAnnual)
  add('STRIPE_PRICE_ID_CLOSER_PLUS', prices.closerPlusMonthly)
  add('STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL', prices.closerPlusAnnual)
  add('STRIPE_PRICE_ID_TEAM', prices.teamMonthly)
  add('STRIPE_PRICE_ID_TEAM_ANNUAL', prices.teamAnnual)
  add('STRIPE_PRICE_ID_TEAM_BASE', prices.teamBaseMonthly)
  add('STRIPE_PRICE_ID_TEAM_SEAT', prices.teamSeatMonthly)
  add('STRIPE_PRICE_ID_TEAM_BASE_ANNUAL', prices.teamBaseAnnual)
  add('STRIPE_PRICE_ID_TEAM_SEAT_ANNUAL', prices.teamSeatAnnual)

  const selected = new Set<string>()
  for (const lineItem of args.lineItems) {
    const names = valueToNames.get(lineItem.price)
    if (!names) continue
    for (const name of names) selected.add(name)
  }

  if (selected.size === 0) {
    if (args.planId === 'pro') {
      selected.add(args.billingCycle === 'annual' ? 'STRIPE_PRICE_ID_CLOSER_ANNUAL' : 'STRIPE_PRICE_ID_PRO')
    } else if (args.planId === 'closer_plus') {
      selected.add(
        args.billingCycle === 'annual' ? 'STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL' : 'STRIPE_PRICE_ID_CLOSER_PLUS'
      )
    } else if (args.billingCycle === 'annual') {
      selected.add('STRIPE_PRICE_ID_TEAM_ANNUAL')
      selected.add('STRIPE_PRICE_ID_TEAM_BASE_ANNUAL')
      selected.add('STRIPE_PRICE_ID_TEAM_SEAT_ANNUAL')
    } else {
      selected.add('STRIPE_PRICE_ID_TEAM')
      selected.add('STRIPE_PRICE_ID_TEAM_BASE')
      selected.add('STRIPE_PRICE_ID_TEAM_SEAT')
    }
  }

  return Array.from(selected)
}

function isMissingRowError(code: string | null | undefined): boolean {
  return code === 'PGRST116'
}

function buildCheckoutError(
  code: CheckoutErrorCode,
  message: string,
  status: number,
  bridge: NextResponse,
  requestId: string,
  details?: unknown
) {
  return fail(code, message, details, { status }, bridge, requestId)
}

function createSessionParams(args: {
  customerId: string
  lineItems: CheckoutLineItem[]
  planId: PaidPlanId
  billingCycle: BillingCycle
  seats: number | undefined
  siteUrl: string
  userId: string
  userEmail: string | null | undefined
}): Stripe.Checkout.SessionCreateParams {
  return {
    customer: args.customerId,
    mode: 'subscription',
    payment_method_collection: 'always',
    payment_method_types: ['card'],
    line_items: args.lineItems,
    success_url: `${args.siteUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.siteUrl}/pricing`,
    client_reference_id: args.userId,
    metadata: {
      user_id: args.userId,
      email: args.userEmail ?? '',
      plan_id: args.planId,
      product_plan: args.planId === 'team' ? 'agency' : 'pro',
      billing_cycle: args.billingCycle,
      seats: typeof args.seats === 'number' ? String(args.seats) : '',
    },
    subscription_data: {
      metadata: {
        user_id: args.userId,
      },
    },
    allow_promotion_codes: true,
  }
}

export async function POST(request: NextRequest) {
  return POST_GUARDED(request)
}

export async function GET() {
  return fail('METHOD_NOT_ALLOWED', 'Method not allowed. Use POST /api/checkout.', undefined, { status: 405 })
}

const POST_GUARDED = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    let parsedBody: z.infer<typeof CheckoutBodySchema>
    try {
      const raw = await readBodyWithLimit(request, 32768)
      if (!raw || raw.trim().length === 0) {
        return buildCheckoutError(
          'INVALID_CHECKOUT_PAYLOAD',
          'Missing JSON body',
          400,
          bridge,
          requestId,
          { hint: 'Send JSON like { "planId": "pro" }' }
        )
      }
      const json = JSON.parse(raw) as unknown
      const parsed = CheckoutBodySchema.safeParse(json)
      if (!parsed.success) {
        return buildCheckoutError(
          'INVALID_CHECKOUT_PAYLOAD',
          'Invalid checkout payload',
          422,
          bridge,
          requestId,
          parsed.error.errors.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          }))
        )
      }
      parsedBody = parsed.data
    } catch (error) {
      const details = getCheckoutErrorDetails(error)
      return buildCheckoutError(
        'INVALID_CHECKOUT_PAYLOAD',
        details.errorMessage?.startsWith('Invalid JSON')
          ? details.errorMessage
          : 'Invalid JSON body',
        400,
        bridge,
        requestId
      )
    }

    const billingCycle: BillingCycle = parsedBody.billingCycle ?? 'monthly'
    logger.info({
      level: 'info',
      scope: 'checkout',
      message: 'checkout.start',
      requestId,
      planId: parsedBody.planId,
      billingInterval: billingCycle,
      stripeMode: getStripeMode(),
    })

    const supabase = createRouteClient(request, bridge)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return buildCheckoutError('AUTH_REQUIRED', 'Please sign in to upgrade.', 401, bridge, requestId)
    }

    const planId = normalizeCheckoutPlanId(parsedBody.planId)
    if (!planId) {
      return buildCheckoutError('UNSUPPORTED_PLAN', 'Selected plan is unavailable.', 400, bridge, requestId, {
        planId: parsedBody.planId,
      })
    }

    const stripeMode = getStripeMode()
    const seats = parsedBody.seats
    const env = validateStripeEnv()

    try {
      assertProdStripeConfig()
    } catch {
      return buildCheckoutError(
        'CHECKOUT_CONFIG_MISSING',
        'Checkout is not configured yet.',
        503,
        bridge,
        requestId,
        { required: ['STRIPE_SECRET_KEY (live key required in production)'] }
      )
    }

    if (!env.hasStripeSecretKey) {
      return buildCheckoutError(
        'CHECKOUT_CONFIG_MISSING',
        'Checkout is not configured yet.',
        503,
        bridge,
        requestId,
        { required: ['STRIPE_SECRET_KEY'] }
      )
    }

    const resolvedLineItems = resolveCheckoutLineItems(planId, billingCycle, seats)
    const selectedEnvNames = selectedPriceEnvVarNames({
      planId,
      billingCycle,
      lineItems: resolvedLineItems.ok ? resolvedLineItems.lineItems : [],
    })

    if (!resolvedLineItems.ok) {
      return buildCheckoutError(
        'CHECKOUT_CONFIG_MISSING',
        'Checkout is not configured yet.',
        503,
        bridge,
        requestId,
        { missing: resolvedLineItems.missing, selectedPriceEnvVarNames: selectedEnvNames }
      )
    }

    const siteUrl = resolveSiteUrl({ request, configuredSiteUrl: env.siteUrl })
    if (!siteUrl) {
      return buildCheckoutError(
        'CHECKOUT_CONFIG_MISSING',
        'Checkout is not configured yet.',
        503,
        bridge,
        requestId,
        { required: ['NEXT_PUBLIC_SITE_URL'], selectedPriceEnvVarNames: selectedEnvNames }
      )
    }

    logger.info({
      level: 'info',
      scope: 'checkout',
      message: 'checkout.config.summary',
      requestId,
      planId,
      billingInterval: billingCycle,
      stripeMode,
      hasUser: true,
      hasStripeSecretKey: env.hasStripeSecretKey,
      hasPriceConfig: true,
      hasSiteUrl: Boolean(siteUrl),
      selectedPriceEnvVarNames: selectedEnvNames,
    })

    const priceValidation = await validateSubscriptionLineItemsAreRecurring(stripe, resolvedLineItems.lineItems)
    if (!priceValidation.ok) {
      return buildCheckoutError(
        'CHECKOUT_CONFIG_MISSING',
        'Checkout is not configured yet.',
        503,
        bridge,
        requestId,
        {
          reason: priceValidation.reason,
          selectedPriceEnvVarNames: selectedEnvNames,
        }
      )
    }

    const { data: userRow, error: userRowError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (userRowError && !isMissingRowError(userRowError.code)) {
      logger.warn({
        level: 'warn',
        scope: 'checkout',
        message: 'checkout.customer.lookup',
        requestId,
        planId,
        billingInterval: billingCycle,
        stripeMode,
        hasStoredCustomer: false,
        userLookupErrorCode: userRowError.code ?? null,
      })
    }

    let customerId =
      userRow && typeof userRow.stripe_customer_id === 'string' && userRow.stripe_customer_id.trim().length > 0
        ? userRow.stripe_customer_id.trim()
        : null

    logger.info({
      level: 'info',
      scope: 'checkout',
      message: 'checkout.customer.lookup',
      requestId,
      planId,
      billingInterval: billingCycle,
      stripeMode,
      hasStoredCustomer: Boolean(customerId),
    })

    if (customerId && !customerId.startsWith('cus_')) {
      logger.warn({
        level: 'warn',
        scope: 'checkout',
        message: 'checkout.customer.invalid',
        requestId,
        planId,
        billingInterval: billingCycle,
        stripeMode,
        reason: 'malformed_stored_customer_id',
        customerIdHint: redactStripeId(customerId),
      })
      customerId = null
    }

    const persistCustomerId = async (nextCustomerId: string): Promise<void> => {
      const { error: upsertError } = await supabase.from('users').upsert({
        id: user.id,
        email: user.email,
        stripe_customer_id: nextCustomerId,
      })
      if (upsertError) {
        logger.warn({
          level: 'warn',
          scope: 'checkout',
          message: 'checkout.customer.lookup',
          requestId,
          planId,
          billingInterval: billingCycle,
          stripeMode,
          hasStoredCustomer: true,
          userLookupErrorCode: upsertError.code ?? null,
        })
      }
    }

    const createCustomer = async (): Promise<string> => {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      await persistCustomerId(customer.id)
      return customer.id
    }

    if (!customerId) {
      try {
        customerId = await createCustomer()
      } catch (createCustomerError) {
        const details = getCheckoutErrorDetails(createCustomerError)
        logger.error({
          level: 'error',
          scope: 'checkout',
          message: 'checkout.session.create.failed',
          requestId,
          planId,
          billingInterval: billingCycle,
          stripeMode,
          selectedPriceEnvVarNames: selectedEnvNames,
          stage: 'create_customer',
          ...details,
        })
        return buildCheckoutError(
          'CHECKOUT_SESSION_CREATE_FAILED',
          'Checkout is temporarily unavailable. Please try again shortly.',
          502,
          bridge,
          requestId,
          { stripeCode: details.stripeCode, stripeType: details.stripeType }
        )
      }
    }

    const { data: existingSubscription, error: existingSubscriptionError } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle()

    if (existingSubscriptionError && !isMissingRowError(existingSubscriptionError.code)) {
      return buildCheckoutError(
        'INTERNAL_CHECKOUT_ERROR',
        'Checkout is currently unavailable. Please try again later.',
        500,
        bridge,
        requestId
      )
    }

    if (existingSubscription) {
      return fail('CONFLICT', 'Already subscribed', undefined, { status: 409 }, bridge, requestId)
    }

    const doCreateSession = async (selectedCustomerId: string): Promise<Stripe.Checkout.Session> => {
      logger.info({
        level: 'info',
        scope: 'checkout',
        message: 'checkout.session.create.start',
        requestId,
        planId,
        billingInterval: billingCycle,
        stripeMode,
        hasCustomer: true,
        selectedPriceEnvVarNames: selectedEnvNames,
      })
      return stripe.checkout.sessions.create(
        createSessionParams({
          customerId: selectedCustomerId,
          lineItems: resolvedLineItems.lineItems,
          planId,
          billingCycle,
          seats,
          siteUrl,
          userId: user.id,
          userEmail: user.email,
        })
      )
    }

    let session: Stripe.Checkout.Session
    try {
      session = await doCreateSession(customerId)
    } catch (createSessionError) {
      const firstFailure = getCheckoutErrorDetails(createSessionError)
      logger.error({
        level: 'error',
        scope: 'checkout',
        message: 'checkout.session.create.failed',
        requestId,
        planId,
        billingInterval: billingCycle,
        stripeMode,
        selectedPriceEnvVarNames: selectedEnvNames,
        stage: 'initial',
        customerIdHint: redactStripeId(customerId),
        ...firstFailure,
      })

      if (customerId && isStripeMissingCustomerError(firstFailure)) {
        logger.warn({
          level: 'warn',
          scope: 'checkout',
          message: 'checkout.customer.invalid',
          requestId,
          planId,
          billingInterval: billingCycle,
          stripeMode,
          reason: 'stripe_missing_customer',
          customerIdHint: redactStripeId(customerId),
        })
        logger.warn({
          level: 'warn',
          scope: 'checkout',
          message: 'checkout.session.create.retry',
          requestId,
          planId,
          billingInterval: billingCycle,
          stripeMode,
          selectedPriceEnvVarNames: selectedEnvNames,
        })

        try {
          customerId = await createCustomer()
          session = await doCreateSession(customerId)
        } catch (retryError) {
          const retryFailure = getCheckoutErrorDetails(retryError)
          logger.error({
            level: 'error',
            scope: 'checkout',
            message: 'checkout.session.create.failed',
            requestId,
            planId,
            billingInterval: billingCycle,
            stripeMode,
            selectedPriceEnvVarNames: selectedEnvNames,
            stage: 'retry',
            ...retryFailure,
          })
          return buildCheckoutError(
            'CHECKOUT_SESSION_CREATE_FAILED',
            'Checkout is temporarily unavailable. Please try again shortly.',
            502,
            bridge,
            requestId,
            { stripeCode: retryFailure.stripeCode, stripeType: retryFailure.stripeType }
          )
        }
      } else {
        return buildCheckoutError(
          'CHECKOUT_SESSION_CREATE_FAILED',
          'Checkout is temporarily unavailable. Please try again shortly.',
          502,
          bridge,
          requestId,
          { stripeCode: firstFailure.stripeCode, stripeType: firstFailure.stripeType }
        )
      }
    }

    const sessionUrl = session.url ?? null
    if (!sessionUrl) {
      return buildCheckoutError(
        'CHECKOUT_SESSION_CREATE_FAILED',
        'Checkout is temporarily unavailable. Please try again shortly.',
        502,
        bridge,
        requestId
      )
    }

    logger.info({
      level: 'info',
      scope: 'checkout',
      message: 'checkout.session.create.success',
      requestId,
      planId,
      billingInterval: billingCycle,
      stripeMode,
      selectedPriceEnvVarNames: selectedEnvNames,
      hasCustomer: true,
    })

    return ok({ url: sessionUrl }, undefined, bridge, requestId)
  } catch (error) {
    const details = getCheckoutErrorDetails(error)
    logger.error({
      level: 'error',
      scope: 'checkout',
      message: 'checkout.session.create.failed',
      requestId,
      stage: 'unhandled',
      ...details,
    })
    return buildCheckoutError(
      'INTERNAL_CHECKOUT_ERROR',
      'Checkout is currently unavailable. Please try again later.',
      500,
      bridge,
      requestId
    )
  }
})
