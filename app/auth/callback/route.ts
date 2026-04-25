import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  clearDemoHandoffCookieOnResponse,
  claimDemoHandoffFromRequest,
} from '@/lib/demo/claim'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logCanonicalFunnelEvent } from '@/lib/analytics/funnel-events'
import { claimReferralReward } from '@/lib/referrals/claim'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const ref = requestUrl.searchParams.get('ref')

  if (code) {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      // Redirect to login with error
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      )
    }

    // Best-effort demo handoff claim so post-signup users land with persisted leads.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      try {
        await claimDemoHandoffFromRequest({
          request,
          userId: user.id,
          supabase,
        })
      } catch {
        // Never block auth callback redirect for demo handoff failures.
      }

      // Best-effort canonical funnel event for email-confirmed signups.
      try {
        const admin = createSupabaseAdminClient({ schema: 'api' })
        await logCanonicalFunnelEvent({
          supabase: admin,
          userId: user.id,
          eventName: 'signup_completed',
          eventProps: {
            source: 'auth_callback',
            method: 'email_confirmation',
            next,
          },
        })
      } catch {
        // best-effort only
      }

      // Best-effort referral reward claim.
      if (ref && ref.trim().length > 0) {
        try {
          await claimReferralReward({
            referredUserId: user.id,
            referrerId: ref.trim(),
          })
        } catch {
          // best-effort only
        }
      }
    }
  }

  // Redirect to the next URL (or default to dashboard)
  const response = NextResponse.redirect(new URL(next, requestUrl.origin))
  clearDemoHandoffCookieOnResponse(response)
  return response
}
