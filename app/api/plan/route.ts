import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { hasEverHadTrial, isEligibleForNewTrial, type SubscriptionTrialRow, type UserTrialRow } from '@/lib/billing/entitlements'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'
import { serverEnv } from '@/lib/env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createHash } from 'crypto'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

type PlanTier = 'starter' | 'closer' | 'team'

function isActiveStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing'
}

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
        const tier = (userRow as { subscription_tier?: string | null } | null)?.subscription_tier ?? 'free'
        if (needsInit && tier !== 'pro' && tier !== 'team') {
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

    // Stripe subscription is the source of truth for Starter vs paid tiers:
    // - No active subscription => Starter
    // - Active/trialing subscription => paid (Closer or Team based on price id)
    const { data: subRow } = await supabase
      .schema('api')
      .from('subscriptions')
      .select('status, stripe_price_id, price_id, trial_end, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const status = (subRow as { status?: string | null } | null)?.status ?? null
    const hasActiveSubscription = isActiveStatus(status)

    let tier: PlanTier = 'starter'
    let planId: string | null = null

    if (hasActiveSubscription) {
      const configuredCloserPrice = (serverEnv.STRIPE_PRICE_ID_PRO || serverEnv.STRIPE_PRICE_ID || '').trim()
      const subPrice =
        (subRow as { stripe_price_id?: string | null } | null)?.stripe_price_id ??
        (subRow as { price_id?: string | null } | null)?.price_id ??
        null

      // If the subscription price differs from the configured "Closer" price, treat as Team.
      // (No Stripe ID changes here; this is detection only.)
      if (configuredCloserPrice && typeof subPrice === 'string' && subPrice.length > 0 && subPrice !== configuredCloserPrice) {
        tier = 'team'
        planId = 'team'
      } else {
        tier = 'closer'
        planId = 'pro'
      }
    }

    // Trial display is best-effort and MUST NOT promote a user into paid tiers.
    const stripeTrialEnd = (subRow as { trial_end?: string | null } | null)?.trial_end ?? null
    const isStripeTrialing = status === 'trialing' && Boolean(stripeTrialEnd)
    let trial: { active: boolean; endsAt: string | null } = isStripeTrialing
      ? { active: true, endsAt: stripeTrialEnd }
      : { active: false, endsAt: null }

    if (!trial.active && enableAppTrial) {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('trial_ends_at')
          .eq('id', user.id)
          .maybeSingle()
        const appTrialEndsAt = (userRow as { trial_ends_at?: string | null } | null)?.trial_ends_at ?? null
        if (appTrialEndsAt && Date.parse(appTrialEndsAt) > Date.now()) {
          trial = { active: true, endsAt: appTrialEndsAt }
        }
      } catch {
        // fail-open
      }
    }

    // Product analytics (best-effort; behind env flag).
    if (serverEnv.ENABLE_PRODUCT_ANALYTICS === '1' || serverEnv.ENABLE_PRODUCT_ANALYTICS === 'true') {
      void logProductEvent({
        userId: user.id,
        eventName: 'plan_checked',
        eventProps: {
          tier,
        },
      })
    }
    return ok(
      {
        // Keep legacy `plan` (used by existing clients) but do NOT infer paid access from app-level trial.
        plan: tier === 'starter' ? 'free' : 'pro',
        tier,
        planId,
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
