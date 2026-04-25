import { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createRouteClient } from '@/lib/supabase/route'
import { serverEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'
import { z } from 'zod'
import { readBodyWithLimit } from '@/lib/api/validate'
import { captureMessage } from '@/lib/observability/sentry'
import { logger } from '@/lib/observability/logger'
import { assertProdStripeConfig } from '@/lib/config/runtimeEnv'
import { getPriceIdsFromEnv, resolveCheckoutLineItems, type BillingCycle, type CheckoutLineItem, type PaidPlanId } from '@/lib/billing/stripePriceMap'
import { isHouseCloserEmail } from '@/lib/billing/houseAccounts'
import { validateSubscriptionLineItemsAreRecurring } from '@/lib/billing/stripePriceValidation'

/**
 * Validates required Stripe environment variables
 * @throws Error with clear message if validation fails
 */
function validateStripeEnv(): { siteUrl: string } {
  // STRIPE_SECRET_KEY is already validated in lib/stripe.ts via serverEnv

  // Get site URL (optional, defaults to request origin)
  const siteUrl = serverEnv.NEXT_PUBLIC_SITE_URL || ''

  return { siteUrl }
}

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

function sanitizeErrorMessage(message: string | null): string | null {
  if (!message) return null
  return message.length > 400 ? `${message.slice(0, 397)}...` : message
}

function getCheckoutErrorDetails(error: unknown): CheckoutErrorDetails {
  const err = (typeof error === 'object' && error !== null ? error : {}) as StripeErrorLike
  const errorName = typeof err.name === 'string' ? err.name : error instanceof Error ? error.name : null
  const rawMessage = typeof err.message === 'string' ? err.message : error instanceof Error ? error.message : null
  return {
    errorName,
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

  // If values are not resolvable (or line items are empty), provide deterministic expectation.
  if (selected.size === 0) {
    if (args.planId === 'pro') {
      selected.add(args.billingCycle === 'annual' ? 'STRIPE_PRICE_ID_CLOSER_ANNUAL' : 'STRIPE_PRICE_ID_PRO')
    } else if (args.planId === 'closer_plus') {
      selected.add(args.billingCycle === 'annual' ? 'STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL' : 'STRIPE_PRICE_ID_CLOSER_PLUS')
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

function resolveSiteUrl(args: { request: NextRequest; configuredSiteUrl: string }): string {
  const configured = args.configuredSiteUrl.trim()
  if (configured) return configured

  const origin = args.request.nextUrl.origin?.trim()
  if (origin) return origin

  if (serverEnv.NODE_ENV === 'development') {
    return 'http://localhost:3000'
  }

  return ''
}

export async function POST(request: NextRequest) {
  return POST_GUARDED(request)
}

export async function GET(_request: NextRequest) {
  // Explicitly return JSON (not Next.js default 404) so callers get a clear signal.
  return fail(
    'METHOD_NOT_ALLOWED',
    'Method not allowed. Use POST /api/checkout.',
    undefined,
    { status: 405 }
  )
}

const CheckoutBodySchema = z.object({
  // Validate supported values manually so we can return a stable 400 for unsupported plans.
  planId: z.string().min(1),
  billingCycle: z.enum(['monthly', 'annual']).optional(),
  seats: z
    .number()
    .int()
    .min(1)
    .max(250)
    .optional(),
})

function normalizeCheckoutPlanId(rawPlanId: string): PaidPlanId | null {
  const normalized = rawPlanId.trim().toLowerCase()
  if (normalized === 'pro' || normalized === 'closer') return 'pro'
  if (normalized === 'agency' || normalized === 'team') return 'team'
  if (normalized === 'closer_plus') return 'closer_plus'
  return null
}

const POST_GUARDED = withApiGuard(
  async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    // Parse + validate body here (not in guard) so we can return route-specific error codes.
    // Also enforces an explicit 32KB limit.
    let parsedBody: z.infer<typeof CheckoutBodySchema>
    try {
      const raw = await readBodyWithLimit(request, 32768)
      if (!raw || raw.trim().length === 0) {
        return fail(
          'INVALID_CHECKOUT_PAYLOAD',
          'Missing JSON body',
          { hint: 'Send JSON like { "planId": "pro" }' },
          { status: 400 },
          bridge,
          requestId
        )
      }
      const json = JSON.parse(raw)
      const result = CheckoutBodySchema.safeParse(json)
      if (!result.success) {
        return fail(
          'INVALID_CHECKOUT_PAYLOAD',
          'Invalid checkout payload',
          result.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message, code: e.code })),
          { status: 422 },
          bridge,
          requestId
        )
      }
      parsedBody = result.data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JSON body'
      return fail(
        'INVALID_CHECKOUT_PAYLOAD',
        message.startsWith('Invalid JSON') ? message : 'Invalid JSON body',
        undefined,
        { status: 400 },
        bridge,
        requestId
      )
    }

    // Dev-only breadcrumb logging (no secrets).
    if (serverEnv.NODE_ENV === 'development') {
      console.log('[checkout] Request received', {
        requestId,
        planId: parsedBody.planId,
        hasStripeSecretKey: Boolean(serverEnv.STRIPE_SECRET_KEY),
        hasProPriceId: Boolean(serverEnv.STRIPE_PRICE_ID || serverEnv.STRIPE_PRICE_ID_PRO),
        hasTeamPriceId: Boolean(serverEnv.STRIPE_PRICE_ID_TEAM),
      })
    }

    // Create Supabase client using the bridge response (cookies will be set on bridge)
    const supabase = createRouteClient(request, bridge)
    
    // Get current user (this may set cookies on bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const isOwnerDebug = isHouseCloserEmail(user.email ?? null, process.env.HOUSE_CLOSER_EMAILS)

    const rawPlanId = parsedBody.planId
    const planId = normalizeCheckoutPlanId(rawPlanId)

    if (!planId) {
      return fail(
        'INVALID_CHECKOUT_PLAN',
        'Invalid or unsupported planId',
        { planId: rawPlanId },
        { status: 400 },
        bridge,
        requestId
      )
    }

    const billingCycle: BillingCycle = parsedBody.billingCycle ?? 'monthly'
    const seats = parsedBody.seats
    const isDevelopment = serverEnv.NODE_ENV === 'development'

    // Production safety: block accidental Stripe test keys.
    // (No effect in dev/staging; enforced only when NEXT_PUBLIC_APP_ENV === "production".)
    assertProdStripeConfig()

    // Validate Stripe environment variables
    let siteUrl: string
    let lineItems: CheckoutLineItem[] = []
    try {
      const env = validateStripeEnv()
      // IMPORTANT: Do not accept price IDs from the client. Always map from server-side plan definition.
      const resolved = resolveCheckoutLineItems(planId, billingCycle, seats)
      if (!resolved.ok) {
        captureMessage('checkout_not_configured', { route: '/api/checkout', requestId, planId, billingCycle })
        return fail(
          'CHECKOUT_NOT_CONFIGURED',
          `Missing Stripe price ID for plan: ${planId}`,
          {
            planId,
            billingCycle,
            missing: resolved.missing,
          },
          { status: 500 },
          bridge,
          requestId
        )
      }
      lineItems = resolved.lineItems
      siteUrl = resolveSiteUrl({ request, configuredSiteUrl: env.siteUrl })
      if (!siteUrl) {
        logger.error({
          level: 'error',
          scope: 'checkout',
          message: 'site_url_unavailable',
          requestId,
          planId,
          selectedPriceEnvVarNames: selectedPriceEnvVarNames({ planId, billingCycle, lineItems }),
        })
        return fail(
          'CHECKOUT_NOT_CONFIGURED',
          'Checkout base URL is not configured',
          { required: ['NEXT_PUBLIC_SITE_URL'] },
          { status: 500 },
          bridge,
          requestId
        )
      }
    } catch (error) {
      const details = getCheckoutErrorDetails(error)
      logger.error({
        level: 'error',
        scope: 'checkout',
        message: 'line_items_resolve_failed',
        requestId,
        planId,
        billingCycle,
        selectedPriceEnvVarNames: selectedPriceEnvVarNames({ planId, billingCycle, lineItems }),
        ...details,
      })
      captureMessage('checkout_not_configured', {
        route: '/api/checkout',
        requestId,
      })
      return fail(
        'CHECKOUT_NOT_CONFIGURED',
        isDevelopment && details.errorMessage
          ? details.errorMessage
          : `Checkout is not configured for plan: ${planId}`,
        {
          // Do not leak env values; just explain what is missing.
          message: details.errorMessage ?? 'Missing Stripe configuration',
          required: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID_PRO (recommended)', 'NEXT_PUBLIC_SITE_URL (recommended)'],
          ...(isDevelopment ? details : {}),
        },
        { status: 500 },
        bridge,
        requestId
      )
    }

    const stripeMode = serverEnv.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test'

    logger.info({
      level: 'info',
      scope: 'checkout',
      message: 'config.summary',
      planId,
      stripeMode,
      hasStripeSecretKey: !!serverEnv.STRIPE_SECRET_KEY,
      proPriceId: serverEnv.STRIPE_PRICE_ID_PRO ?? serverEnv.STRIPE_PRICE_ID ?? null,
      teamPriceId: serverEnv.STRIPE_PRICE_ID_TEAM ?? null,
    })

    // Fail fast before creating a Stripe customer if a configured "subscription" price is not recurring.
    // This avoids orphan Stripe customers caused by price misconfiguration.
    const priceValidation = await validateSubscriptionLineItemsAreRecurring(stripe, lineItems)
    if (!priceValidation.ok) {
      const details =
        priceValidation.reason === 'stripe_error'
          ? { ...priceValidation.error, priceId: priceValidation.priceId }
          : { reason: priceValidation.reason, invalidPrices: priceValidation.invalidPrices }

      logger.error({
        level: 'error',
        scope: 'checkout',
        message: 'subscription_price_validation_failed',
        requestId,
        planId,
        billingCycle,
        selectedPriceEnvVarNames: selectedPriceEnvVarNames({ planId, billingCycle, lineItems }),
        ...details,
      })

      return fail(
        'CHECKOUT_NOT_CONFIGURED',
        'Stripe price configuration is invalid for subscription checkout',
        {
          planId,
          billingCycle,
          ...details,
          hint: 'All prices used with mode="subscription" must be recurring (monthly/yearly) and active.',
        },
        { status: 500 },
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
    const createCustomer = async (): Promise<string> => {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      const nextCustomerId = customer.id

      // Update user in database
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          stripe_customer_id: nextCustomerId,
        })
      if (upsertError) {
        logger.error({
          level: 'error',
          scope: 'checkout',
          message: 'customer_id_upsert_failed',
          requestId,
          planId,
          userId: user.id,
          customerId: nextCustomerId,
          errorCode: upsertError.code,
        })
      }
      return nextCustomerId
    }

    if (!customerId) {
      customerId = await createCustomer()
    }

    // Check for existing active/trialing subscription (avoid duplicate checkouts)
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
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
    let sessionUrl: string | null = null
    const createSessionParams = (selectedCustomerId: string): Stripe.Checkout.SessionCreateParams => ({
      customer: selectedCustomerId,
      mode: 'subscription',
      // Collect payment method up-front.
      payment_method_collection: 'always',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${siteUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        email: user.email ?? '',
        plan_id: planId,
        product_plan: planId === 'team' ? 'agency' : 'pro',
        billing_cycle: billingCycle,
        seats: typeof seats === 'number' ? String(seats) : '',
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
      },
      allow_promotion_codes: true,
    })

    try {
      const session = await stripe.checkout.sessions.create(createSessionParams(customerId))
      sessionUrl = session.url ?? null
    } catch (error) {
      const firstFailure = getCheckoutErrorDetails(error)
      logger.error({
        level: 'error',
        scope: 'checkout',
        message: 'session.create_failed',
        requestId,
        planId,
        stripeMode,
        selectedPriceEnvVarNames: selectedPriceEnvVarNames({ planId, billingCycle, lineItems }),
        ...firstFailure,
      })

      // Common root cause during test/live mode switches:
      // stored customer id belongs to a different Stripe mode and no longer exists.
      if (customerId && isStripeMissingCustomerError(firstFailure)) {
        try {
          logger.warn({
            level: 'warn',
            scope: 'checkout',
            message: 'session.create_retry_new_customer',
            requestId,
            planId,
            priorCustomerId: customerId,
          })
          customerId = await createCustomer()
          const retrySession = await stripe.checkout.sessions.create(createSessionParams(customerId))
          sessionUrl = retrySession.url ?? null
        } catch (retryError) {
          const retryFailure = getCheckoutErrorDetails(retryError)
          logger.error({
            level: 'error',
            scope: 'checkout',
            message: 'session.create_retry_failed',
            requestId,
            planId,
            stripeMode,
            selectedPriceEnvVarNames: selectedPriceEnvVarNames({ planId, billingCycle, lineItems }),
            ...retryFailure,
          })
          return fail(
            ErrorCode.EXTERNAL_API_ERROR,
            isDevelopment && retryFailure.errorMessage
              ? retryFailure.errorMessage
              : 'Stripe checkout session creation failed',
            {
              ...retryFailure,
            },
            { status: 500 },
            bridge,
            requestId
          )
        }
      }

      if (sessionUrl) {
        return ok({ url: sessionUrl }, undefined, bridge, requestId)
      }

      // Keep the user-facing message stable, but include safe Stripe metadata for troubleshooting.
      // (No secrets, no env values, no full payloads.)
      return fail(
        ErrorCode.EXTERNAL_API_ERROR,
        isDevelopment && firstFailure.errorMessage
          ? firstFailure.errorMessage
          : 'Stripe checkout session creation failed',
        firstFailure,
        { status: 500 },
        bridge,
        requestId
      )
    }

    // Return standardized success response
    if (!sessionUrl) {
      return fail(
        ErrorCode.INTERNAL_ERROR,
        'Stripe checkout session missing redirect URL',
        undefined,
        { status: 500 },
        bridge,
        requestId
      )
    }

    return ok({ url: sessionUrl }, undefined, bridge, requestId)
  } catch (error) {
    const details = getCheckoutErrorDetails(error)
    logger.error({
      level: 'error',
      scope: 'checkout',
      message: 'checkout_unhandled_error',
      requestId,
      ...details,
    })
    if (serverEnv.NODE_ENV === 'development' && details.errorMessage) {
      return fail(
        ErrorCode.INTERNAL_ERROR,
        details.errorMessage,
        details,
        { status: 500 },
        bridge,
        requestId
      )
    }
    return asHttpError(error, '/api/checkout', undefined, bridge, requestId)
  }
},
  // No bodySchema: we validate body inside handler for custom error codes.
)
