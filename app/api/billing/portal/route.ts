import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createRouteClient } from '@/lib/supabase/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createCookieBridge } from '@/lib/api/http'
import { jsonWithCookies } from '@/lib/http/json'
import { logger } from '@/lib/observability/logger'
import { withApiGuard } from '@/lib/api/guard'
import { getRequestId } from '@/lib/api/with-request-id'

type PortalSuccess = { url: string }
type PortalError = { error: 'unauthorized' | 'billing_portal_failed' }

function getReturnUrl(request: NextRequest): string {
  const envUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim()
  const base = (envUrl || request.nextUrl.origin || 'http://localhost:3000').replace(/\/+$/, '')
  return `${base}/dashboard`
}

export const POST = withApiGuard(async (request: NextRequest) => {
  const requestId = getRequestId(request)
  const bridge = createCookieBridge()
  try {
    // Auth: same cookie-bridged Supabase pattern used in /api/checkout.
    const supabase = createRouteClient(request, bridge)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonWithCookies({ error: 'unauthorized' } satisfies PortalError, { status: 401 }, bridge)
    }

    // Look up the canonical subscription row in the `api` schema (service role).
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { data: subsRows, error: subsError } = await admin
      .from('subscriptions')
      .select('stripe_customer_id,status,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (subsError) {
      logger.warn({
        level: 'warn',
        scope: 'billing',
        message: 'portal.subscription_lookup_failed',
        requestId,
        userId: user.id,
        error: subsError.message,
      })
    }

    const lastSub = subsRows?.[0] ?? null
    const customerId = lastSub?.stripe_customer_id ?? null

    if (!customerId) {
      // Safe fallback: send users without an active subscription/customer to pricing.
      return jsonWithCookies({ url: '/pricing' } satisfies PortalSuccess, { status: 200 }, bridge)
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: getReturnUrl(request),
    })

    return jsonWithCookies({ url: session.url } satisfies PortalSuccess, { status: 200 }, bridge)
  } catch (error) {
    logger.error({
      level: 'error',
      scope: 'billing',
      message: 'portal.failed',
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return jsonWithCookies({ error: 'billing_portal_failed' } satisfies PortalError, { status: 500 }, bridge)
  }
})

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 })
}

