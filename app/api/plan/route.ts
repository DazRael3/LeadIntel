import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { getPlanDetails } from '@/lib/billing/plan'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'
import { serverEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    // Optional app-level trial initialization (flagged; no Stripe changes).
    const enableAppTrial = serverEnv.ENABLE_APP_TRIAL === '1' || serverEnv.ENABLE_APP_TRIAL === 'true'
    if (enableAppTrial) {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('id, subscription_tier, trial_starts_at, trial_ends_at')
          .eq('id', user.id)
          .maybeSingle()

        const needsInit = !userRow || !(userRow as { trial_ends_at?: string | null }).trial_ends_at
        const tier = (userRow as { subscription_tier?: 'free' | 'pro' } | null)?.subscription_tier ?? 'free'
        if (needsInit && tier !== 'pro') {
          const startsAt = new Date().toISOString()
          const endsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          // Safe under RLS: user can upsert their own row.
          await supabase.from('users').upsert({
            id: user.id,
            email: user.email ?? undefined,
            trial_starts_at: startsAt,
            trial_ends_at: endsAt,
          })
        }
      } catch {
        // Schema drift tolerance: if trial columns don't exist, skip silently.
      }
    }

    const details = await getPlanDetails(supabase, user.id)
    const trialEndsAt = details.trialEndsAt ?? null
    const isTrialing = details.subscriptionStatus === 'trialing' && Boolean(trialEndsAt)
    const appTrialEndsAt = details.appTrialEndsAt ?? null
    const isAppTrial = Boolean(details.isAppTrial) && Boolean(appTrialEndsAt)
    const trial =
      isTrialing
        ? { active: true, endsAt: trialEndsAt, kind: 'stripe' as const }
        : isAppTrial
          ? { active: true, endsAt: appTrialEndsAt, kind: 'app' as const }
          : { active: false, endsAt: null, kind: null as const }
    return ok(
      {
        plan: details.plan,
        trial,
      },
      undefined,
      bridge,
      requestId
    )
  } catch (error) {
    return asHttpError(error, '/api/plan', undefined, bridge, requestId)
  }
})
