import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { stripe } from '@/lib/stripe'
import { clientEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'

export const dynamic = 'force-dynamic'

export const POST = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  try {
    const supabase = createRouteClient(request, bridge)

    // Auth is enforced by withApiGuard via lib/api/policy.ts (POST:/api/stripe/portal authRequired: true).
    // This guard is defensive for unexpected misconfiguration.
    if (!userId) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle()

    const customerId = profile?.stripe_customer_id
    if (!customerId) {
      return fail(ErrorCode.NOT_FOUND, 'No Stripe customer found', undefined, undefined, bridge, requestId)
    }

    const siteUrl = clientEnv.NEXT_PUBLIC_SITE_URL || ''
    const returnUrl = siteUrl ? `${siteUrl}/dashboard` : undefined

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return ok({ url: session.url }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/stripe/portal', userId, bridge, requestId)
  }
})
