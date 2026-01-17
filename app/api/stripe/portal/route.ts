import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { stripe } from '@/lib/stripe'
import { clientEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const bridge = createCookieBridge()
  
  try {
    const supabase = createRouteClient(request, bridge)

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    const customerId = profile?.stripe_customer_id
    if (!customerId) {
      return fail(ErrorCode.NOT_FOUND, 'No Stripe customer found', undefined, undefined, bridge)
    }

    const siteUrl = clientEnv.NEXT_PUBLIC_SITE_URL || ''
    const returnUrl = siteUrl ? `${siteUrl}/dashboard` : undefined

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return ok({ url: session.url }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/stripe/portal', undefined, bridge)
  }
}
