import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { getPlanDetails } from '@/lib/billing/plan'
import { hasEverHadTrial, isEligibleForNewTrial, type SubscriptionTrialRow, type UserTrialRow } from '@/lib/billing/entitlements'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'
import { serverEnv } from '@/lib/env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createHash } from 'crypto'
import { logProductEvent } from '@/lib/services/analytics'

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

        const userTrial = (userRow as UserTrialRow | null) ?? null
        const needsInit = !userRow || !(userTrial as { trial_ends_at?: string | null })?.trial_ends_at
        const tier = (userRow as { subscription_tier?: 'free' | 'pro' } | null)?.subscription_tier ?? 'free'
        if (needsInit && tier !== 'pro') {
          const fingerprintingEnabled =
            serverEnv.ENABLE_TRIAL_FINGERPRINTING === '1' || serverEnv.ENABLE_TRIAL_FINGERPRINTING === 'true'
          const userAgent = request.headers.get('user-agent') || ''
          const uaHash = userAgent ? createHash('sha256').update(userAgent).digest('hex') : null
          const forwardedFor = request.headers.get('x-forwarded-for') || ''
          const ip = (forwardedFor.split(',')[0] || request.headers.get('x-real-ip') || '').trim() || null

          // Best-effort fingerprint insert (never blocks).
          if (fingerprintingEnabled) {
            try {
              const admin = createSupabaseAdminClient()
              await admin.from('user_fingerprints').insert({
                user_id: user.id,
                signup_ip: ip,
                signup_user_agent_hash: uaHash,
              })
            } catch {
              // fail-open
            }
          }

          // Enforce "only one trial ever" (fail-open if any check errors).
          let eligible = true
          try {
            const admin = createSupabaseAdminClient()
            const { data: subRows } = await admin
              .from('subscriptions')
              .select('trial_end')
              .eq('user_id', user.id)
              .not('trial_end', 'is', null)
              .limit(1)

            const subs = ((subRows ?? []) as Array<{ trial_end?: string | null }>) satisfies SubscriptionTrialRow[]
            eligible = isEligibleForNewTrial(userTrial ?? { trial_ends_at: null }, subs)

            if (eligible && fingerprintingEnabled && ip && uaHash) {
              const prefix = ip.includes('.') ? ip.split('.').slice(0, 3).join('.') + '.' : ip
              const { data: fpRows } = await admin
                .from('user_fingerprints')
                .select('user_id, signup_ip, signup_user_agent_hash')
                .ilike('signup_ip', `${prefix}%`)
                .eq('signup_user_agent_hash', uaHash)
                .limit(25)

              const typedFpRows = (fpRows ?? []) as Array<{ user_id: string | null }>
              const otherUserIds = Array.from(
                new Set(
                  typedFpRows
                    .map((r: { user_id: string | null }) => r.user_id)
                    .filter((v: string | null): v is string => typeof v === 'string' && v.length > 0 && v !== user.id)
                )
              )

              if (otherUserIds.length > 0) {
                const { data: usersWithTrial } = await admin
                  .from('users')
                  .select('id, trial_ends_at')
                  .in('id', otherUserIds)
                  .not('trial_ends_at', 'is', null)
                  .limit(1)

                if (Array.isArray(usersWithTrial) && usersWithTrial.length > 0) {
                  eligible = false
                } else {
                  const { data: subsWithTrial } = await admin
                    .from('subscriptions')
                    .select('user_id, trial_end')
                    .in('user_id', otherUserIds)
                    .not('trial_end', 'is', null)
                    .limit(1)

                  if (Array.isArray(subsWithTrial) && subsWithTrial.length > 0) {
                    eligible = false
                  }
                }
              }
            }
          } catch {
            // fail-open: do not block trial init on transient errors
            eligible = true
          }

          if (!eligible) {
            // Trial already used (account-level or fingerprint match). Do not grant another.
            // Note: We intentionally fail silent here to keep UX smooth; upgrade paths remain unchanged.
            // (Clients can infer via plan/trial response.)
            // Also mark "ever had trial" for this account if missing (optional): skipped.
            // eslint-disable-next-line no-empty
          } else {
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

    // Product analytics (best-effort; behind env flag).
    if (serverEnv.ENABLE_PRODUCT_ANALYTICS === '1' || serverEnv.ENABLE_PRODUCT_ANALYTICS === 'true') {
      void logProductEvent({
        userId: user.id,
        eventName: 'plan_checked',
        eventProps: {
          plan: details.plan,
          isAppTrial,
        },
      })
    }
    return ok(
      {
        plan: details.plan,
        trial:
          isTrialing
            ? { active: true, endsAt: trialEndsAt }
            : isAppTrial
              ? { active: true, endsAt: appTrialEndsAt }
              : { active: false, endsAt: null },
      },
      undefined,
      bridge,
      requestId
    )
  } catch (error) {
    return asHttpError(error, '/api/plan', undefined, bridge, requestId)
  }
})
