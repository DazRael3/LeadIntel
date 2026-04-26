import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { hasEverHadTrial, isEligibleForNewTrial, type SubscriptionTrialRow, type UserTrialRow } from '@/lib/billing/entitlements'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createHash } from 'crypto'
import { logProductEvent } from '@/lib/services/analytics'
import { logger } from '@/lib/observability/logger'
import { resolveTierFromDb } from '@/lib/billing/resolve-tier'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { getQaOverrideConfig, isQaActorAllowlisted, isQaTargetAllowlisted } from '@/lib/qa/overrides'
import { getTierCapabilities } from '@/lib/billing/capabilities'

export const dynamic = 'force-dynamic'

function flagEnabled(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v) return false
  return v === '1' || v === 'true'
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)

  try {
    // Auth is enforced by withApiGuard via lib/api/policy.ts (GET:/api/plan authRequired: true).
    // This guard is defensive for unexpected misconfiguration.
    if (!userId) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    // Optional app-level trial initialization (flagged; no Stripe changes).
    const enableAppTrial = flagEnabled(process.env.ENABLE_APP_TRIAL)
    if (enableAppTrial) {
      try {
        const { data: userRow } = await supabase
          .schema('api')
          .from('users')
          .select('id, subscription_tier, trial_starts_at, trial_ends_at')
          .eq('id', userId)
          .maybeSingle()

        const userTrial = (userRow as UserTrialRow | null) ?? null
        const needsInit = !userRow || !(userTrial as { trial_ends_at?: string | null })?.trial_ends_at
        const tier = (userRow as { subscription_tier?: string | null } | null)?.subscription_tier ?? 'free'
        if (needsInit && tier !== 'pro' && tier !== 'team') {
          const fingerprintingEnabled = flagEnabled(process.env.ENABLE_TRIAL_FINGERPRINTING)
          const userAgent = request.headers.get('user-agent') || ''
          const uaHash = userAgent ? createHash('sha256').update(userAgent).digest('hex') : null
          const forwardedFor = request.headers.get('x-forwarded-for') || ''
          const ip = (forwardedFor.split(',')[0] || request.headers.get('x-real-ip') || '').trim() || null

          // Best-effort fingerprint insert (never blocks).
          if (fingerprintingEnabled) {
            try {
              const admin = createSupabaseAdminClient({ schema: 'api' })
              await admin.from('user_fingerprints').insert({
                user_id: userId,
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
            const admin = createSupabaseAdminClient({ schema: 'api' })
            const { data: subRows } = await admin
              .from('subscriptions')
              .select('trial_end')
              .eq('user_id', userId)
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
                    .filter((v: string | null): v is string => typeof v === 'string' && v.length > 0 && v !== userId)
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
            await supabase.schema('api').from('users').upsert({
              id: userId,
              // Email is optional here; user identity is already established by withApiGuard.
              trial_starts_at: startsAt,
              trial_ends_at: endsAt,
            })
          }
        }
      } catch {
        // Schema drift tolerance: if trial columns don't exist, skip silently.
      }
    }

    // Tier resolution:
    // - Prefer service-role reads for correctness when configured.
    // - Fail-soft to request-scoped reads when service role is missing, so plan surfaces never 500.
    const sessionUser = await getUserSafe(supabase)
    const sessionEmail = sessionUser?.email ?? null
    const hasServiceRole =
      Boolean((process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()) &&
      Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
    const tierClient = hasServiceRole ? (createSupabaseAdminClient({ schema: 'api' }) as any) : (supabase.schema('api') as any)
    const resolved = await resolveTierFromDb(tierClient as any, userId, sessionEmail)
    const tier = resolved.tier
    const planId = resolved.planId
    const isHouseCloserOverride = Boolean(resolved.isHouseCloserOverride)
    const isQaTierOverride = Boolean(resolved.isQaTierOverride)
    const qaOverride = resolved.qaOverride
    const qaCfg = getQaOverrideConfig()
    const qaDebugEligible = Boolean(
      sessionEmail && (isQaActorAllowlisted(sessionEmail) || isQaTargetAllowlisted(sessionEmail))
    )

    // Trial display is best-effort and MUST NOT promote a user into paid tiers.
    const stripeTrialEnd = resolved.stripeTrialEnd
    const isStripeTrialing = resolved.subscriptionStatus === 'trialing' && Boolean(stripeTrialEnd)
    let trial: { active: boolean; endsAt: string | null } = isStripeTrialing
      ? { active: true, endsAt: stripeTrialEnd }
      : { active: false, endsAt: null }

    if (!trial.active && enableAppTrial) {
      try {
        const { data: userRow } = await supabase
          .schema('api')
          .from('users')
          .select('trial_ends_at')
          .eq('id', userId)
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
    if (flagEnabled(process.env.ENABLE_PRODUCT_ANALYTICS)) {
      void logProductEvent({
        userId,
        eventName: 'plan_checked',
        eventProps: {
          tier,
        },
      })
    }

    logger.info({
      level: 'info',
      scope: 'plan',
      message: 'resolve.success',
      requestId,
      userId,
      tier,
      isHouseCloserOverride,
    })

    let debug:
      | {
          rawSubscriptionTier: string | null
          effectiveTier: typeof tier
          subscriptionStatus: string | null
          stripeTrialEnd: string | null
          qa: {
            enabled: boolean
            configured: boolean
            targetAllowlisted: boolean
            override: { tier: string | null; expiresAt: string | null; revokedAt: string | null } | null
            active: boolean
            blockedReason:
              | 'disabled'
              | 'misconfigured'
              | 'target_not_allowlisted'
              | 'stripe_active_or_trialing'
              | 'no_override_set'
              | 'revoked'
              | 'expired'
              | null
          }
        }
      | null = null

    // QA debug panel requires privileged reads (service role). Fail-soft when not configured.
    if (qaDebugEligible && hasServiceRole) {
      const adminForDebug = createSupabaseAdminClient({ schema: 'api' })
      const { data: rawUser } = await adminForDebug.from('users').select('subscription_tier').eq('id', userId).maybeSingle()
      const rawSubscriptionTier = (rawUser as { subscription_tier?: unknown } | null)?.subscription_tier
      const rawTier = typeof rawSubscriptionTier === 'string' ? rawSubscriptionTier : null

      const targetAllowlisted = isQaTargetAllowlisted(sessionEmail)
      const stripeActiveOrTrialing = resolved.subscriptionStatus === 'active' || resolved.subscriptionStatus === 'trialing'

      let overrideRow: { tier: string | null; expiresAt: string | null; revokedAt: string | null } | null = null
      let overrideActive = false
      let blockedReason:
        | 'disabled'
        | 'misconfigured'
        | 'target_not_allowlisted'
        | 'stripe_active_or_trialing'
        | 'no_override_set'
        | 'revoked'
        | 'expired'
        | null = null

      if (!qaCfg.enabled) blockedReason = 'disabled'
      else if (!qaCfg.configured) blockedReason = 'misconfigured'
      else if (!targetAllowlisted) blockedReason = 'target_not_allowlisted'
      else if (stripeActiveOrTrialing) blockedReason = 'stripe_active_or_trialing'
      else {
        const { data: o } = await adminForDebug
          .from('qa_tier_overrides')
          .select('override_tier, expires_at, revoked_at')
          .eq('target_user_id', userId)
          .maybeSingle()
        const row = (o ?? null) as { override_tier?: unknown; expires_at?: unknown; revoked_at?: unknown } | null
        const revokedAt = typeof row?.revoked_at === 'string' ? row.revoked_at : null
        const expiresAt = typeof row?.expires_at === 'string' ? row.expires_at : null
        const overrideTier = typeof row?.override_tier === 'string' ? row.override_tier : null
        overrideRow = { tier: overrideTier, expiresAt, revokedAt }
        if (!row) blockedReason = 'no_override_set'
        else if (revokedAt) blockedReason = 'revoked'
        else if (expiresAt && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) <= Date.now()) blockedReason = 'expired'
        else {
          overrideActive = Boolean(overrideTier)
          blockedReason = null
        }
      }

      debug = {
        rawSubscriptionTier: rawTier,
        effectiveTier: tier,
        subscriptionStatus: resolved.subscriptionStatus ?? null,
        stripeTrialEnd: resolved.stripeTrialEnd ?? null,
        qa: {
          enabled: qaCfg.enabled,
          configured: qaCfg.configured,
          targetAllowlisted,
          override: overrideRow,
          active: Boolean(isQaTierOverride && qaOverride),
          blockedReason,
        },
      }
    }

    return ok(
      {
        // Keep legacy `plan` (used by existing clients) but do NOT infer paid access from app-level trial.
        plan: tier === 'starter' ? 'free' : 'pro',
        tier,
        planId,
        capabilities: getTierCapabilities(tier),
        isHouseCloserOverride,
        isQaTierOverride,
        qaOverride,
        trial,
        qaDebugEligible,
        debug,
      },
      undefined,
      bridge,
      requestId
    )
  } catch (error) {
    return asHttpError(error, '/api/plan', undefined, bridge, requestId)
  }
})
