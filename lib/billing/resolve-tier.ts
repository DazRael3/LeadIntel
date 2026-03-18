import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { isHouseCloserEmail } from '@/lib/billing/houseAccounts'
import { planIdForTier, resolveTierFromStripePriceId } from '@/lib/billing/stripePriceMap'
import { getQaOverrideConfig, isQaTargetAllowed } from '@/lib/qa/overrides'

export type Tier = 'starter' | 'closer' | 'closer_plus' | 'team'

export type ResolvedTier = {
  tier: Tier
  plan: 'free' | 'pro'
  planId: 'pro' | 'closer_plus' | 'team' | null
  isHouseCloserOverride: boolean
  isQaTierOverride: boolean
  qaOverride: { tier: Tier; expiresAt: string | null } | null
  subscriptionStatus: string | null
  stripeTrialEnd: string | null
}

function is42703(error: PostgrestError | null): boolean {
  return Boolean(error && error.code === '42703')
}

function warnNon42703(scope: string, error: PostgrestError | null): void {
  if (!error) return
  if (is42703(error)) return
  // Per requirements: resolver must never throw; warn on unexpected errors.
  // eslint-disable-next-line no-console
  console.warn(`[resolveTierFromDb] ${scope} query failed`, { code: error.code, message: error.message })
}

export async function resolveTierFromDb(
  admin: SupabaseClient<any, 'api', any>,
  userId: string,
  userEmailFromSession?: string | null
): Promise<ResolvedTier> {
  const loadUser = async (): Promise<{
    userRow: { subscription_tier?: string | null; email?: string | null } | null
    userError: PostgrestError | null
  }> => {
    const { data: userRow, error: userError } = await admin
      .from('users')
      .select('subscription_tier,email')
      .eq('id', userId)
      .maybeSingle()

    if (is42703(userError)) {
      // Older schema fallback: column missing. Re-run a minimal select to confirm row existence.
      await admin.from('users').select('id').eq('id', userId).maybeSingle()
      return { userRow: null, userError }
    }

    warnNon42703('users', userError)
    return { userRow: (userRow as { subscription_tier?: string | null; email?: string | null } | null) ?? null, userError }
  }

  const loadSubs = async (): Promise<{
    subsRows: Array<{
      status?: string | null
      trial_end?: string | null
      created_at?: string | null
      stripe_price_id?: string | null
      price_id?: string | null
    }> | null
    subsError: PostgrestError | null
  }> => {
    const { data: subsRows, error: subsError } = await admin
      .from('subscriptions')
      .select('status, trial_end, created_at, stripe_price_id, price_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (is42703(subsError)) {
      // Older schema fallback: trial_end missing.
      const retry = await admin
        .from('subscriptions')
        .select('status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
      warnNon42703('subscriptions(retry)', retry.error)
      return {
        subsRows: Array.isArray(retry.data)
          ? (retry.data as Array<{ status?: string | null; created_at?: string | null }>)
          : [],
        subsError: subsError,
      }
    }

    warnNon42703('subscriptions', subsError)
    return {
      subsRows: Array.isArray(subsRows)
        ? (subsRows as Array<{
            status?: string | null
            trial_end?: string | null
            created_at?: string | null
            stripe_price_id?: string | null
            price_id?: string | null
          }>)
        : [],
      subsError,
    }
  }

  // a) In parallel, load users + subscriptions
  const [{ userRow, userError }, { subsRows, subsError }] = await Promise.all([loadUser(), loadSubs()])
  // (Errors are already warned as required; never throw.)
  void userError
  void subsError

  // c) Determine lastSub
  const lastSub = (subsRows?.[0] ?? null) as
    | { status?: string | null; trial_end?: string | null; stripe_price_id?: string | null; price_id?: string | null }
    | null

  // d) Tier decision rules
  if (lastSub && (lastSub.status === 'active' || lastSub.status === 'trialing')) {
    const price = (lastSub as { stripe_price_id?: string | null; price_id?: string | null } | null)?.stripe_price_id
      ?? (lastSub as { price_id?: string | null } | null)?.price_id
      ?? null
    const mappedTier = resolveTierFromStripePriceId(price)
    const tier: Tier = mappedTier ?? 'closer'
    const planId = planIdForTier(tier) ?? 'pro'
    return {
      tier,
      plan: 'pro',
      planId,
      isHouseCloserOverride: false,
      isQaTierOverride: false,
      qaOverride: null,
      subscriptionStatus: lastSub.status,
      stripeTrialEnd: lastSub.trial_end ?? null,
    }
  }

  // Internal QA tier override (app-side only; no Stripe writes).
  // Safeguards:
  // - only enabled when ENABLE_QA_OVERRIDES is set
  // - only applies to allowlisted internal/test user emails
  // - never overrides an active/trialing Stripe subscription (handled above)
  const qaCfg = getQaOverrideConfig()
  if (qaCfg.enabled && qaCfg.configured) {
    // Prefer the session email when available, but fall back to api.users.email for SSR/server-gated paths
    // where the session email can be missing.
    let candidateEmail = (userEmailFromSession ?? userRow?.email ?? null) as string | null
    if (!candidateEmail) {
      // Final fallback: ask Supabase Auth (service role) for the user's email.
      // This is only used when session + api.users.email are missing.
      try {
        const auth = admin.auth
        const maybeAdmin = (auth as unknown as { admin?: { getUserById?: (id: string) => Promise<unknown> } }).admin
        const getUserById = maybeAdmin?.getUserById
        if (typeof getUserById === 'function') {
          const res = (await getUserById(userId)) as
            | { data?: { user?: { email?: string | null } | null } | null; error?: unknown }
            | undefined
          const email = res?.data?.user?.email ?? null
          candidateEmail = typeof email === 'string' && email.trim().length > 0 ? email.trim() : null
        }
      } catch {
        // fail-open
      }
    }
    const allowTarget = isQaTargetAllowed(candidateEmail)
    if (allowTarget) {
      try {
        const { data: overrideRow } = await admin
          .from('qa_tier_overrides')
          .select('override_tier, expires_at, revoked_at')
          .eq('target_user_id', userId)
          .maybeSingle()

        const row = (overrideRow ?? null) as
          | { override_tier?: unknown; expires_at?: unknown; revoked_at?: unknown }
          | null

        const revokedAt = typeof row?.revoked_at === 'string' ? row.revoked_at : null
        const expiresAt = typeof row?.expires_at === 'string' ? row.expires_at : null
        const isActive =
          revokedAt == null && (expiresAt == null || (Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > Date.now()))
        const overrideTier = typeof row?.override_tier === 'string' ? (row.override_tier as Tier) : null

        if (isActive && overrideTier && (overrideTier === 'starter' || overrideTier === 'closer' || overrideTier === 'closer_plus' || overrideTier === 'team')) {
          const plan: 'free' | 'pro' = overrideTier === 'starter' ? 'free' : 'pro'
          return {
            tier: overrideTier,
            plan,
            planId: planIdForTier(overrideTier) ?? (plan === 'pro' ? 'pro' : null),
            isHouseCloserOverride: false,
            isQaTierOverride: true,
            qaOverride: { tier: overrideTier, expiresAt },
            subscriptionStatus: lastSub?.status ?? null,
            stripeTrialEnd: lastSub?.trial_end ?? null,
          }
        }
      } catch {
        // fail-open: QA override must never break plan resolution
      }
    }
  }

  if (userRow?.subscription_tier === 'pro') {
    return {
      tier: 'closer',
      plan: 'pro',
      planId: 'pro',
      isHouseCloserOverride: false,
      isQaTierOverride: false,
      qaOverride: null,
      subscriptionStatus: lastSub?.status ?? null,
      stripeTrialEnd: lastSub?.trial_end ?? null,
    }
  }

  // Manual/admin tier overrides stored on api.users.subscription_tier.
  // This is used in some deployments where billing sync is asynchronous.
  if (userRow?.subscription_tier === 'team') {
    return {
      tier: 'team',
      plan: 'pro',
      planId: 'team',
      isHouseCloserOverride: false,
      isQaTierOverride: false,
      qaOverride: null,
      subscriptionStatus: lastSub?.status ?? null,
      stripeTrialEnd: lastSub?.trial_end ?? null,
    }
  }

  if (userRow?.subscription_tier === 'closer_plus') {
    return {
      tier: 'closer_plus',
      plan: 'pro',
      planId: 'closer_plus',
      isHouseCloserOverride: false,
      isQaTierOverride: false,
      qaOverride: null,
      subscriptionStatus: lastSub?.status ?? null,
      stripeTrialEnd: lastSub?.trial_end ?? null,
    }
  }

  // House Closer override: if email is in HOUSE_CLOSER_EMAILS, treat as Closer even without subscription.
  const rawHouse = process.env.HOUSE_CLOSER_EMAILS
  if (rawHouse && rawHouse.trim().length > 0) {
    // Primary: use email from auth session when available (more robust than admin lookup).
    if (isHouseCloserEmail(userEmailFromSession ?? null, rawHouse)) {
      return {
        tier: 'closer',
        plan: 'pro',
        planId: 'pro',
        isHouseCloserOverride: true,
        isQaTierOverride: false,
        qaOverride: null,
        subscriptionStatus: lastSub?.status ?? null,
        stripeTrialEnd: lastSub?.trial_end ?? null,
      }
    }

    try {
      const auth = admin.auth
      const maybeAdmin = (auth as unknown as { admin?: { getUserById?: (id: string) => Promise<unknown> } }).admin
      const getUserById = maybeAdmin?.getUserById
      if (typeof getUserById === 'function') {
        const res = (await getUserById(userId)) as
          | { data?: { user?: { email?: string | null } | null } | null; error?: unknown }
          | undefined
        const email = res?.data?.user?.email ?? null
        if (isHouseCloserEmail(email, rawHouse)) {
          return {
            tier: 'closer',
            plan: 'pro',
            planId: 'pro',
            isHouseCloserOverride: true,
            isQaTierOverride: false,
            qaOverride: null,
            subscriptionStatus: lastSub?.status ?? null,
            stripeTrialEnd: lastSub?.trial_end ?? null,
          }
        }
      }
    } catch {
      // fail-open
    }
  }

  return {
    tier: 'starter',
    plan: 'free',
    planId: null,
    isHouseCloserOverride: false,
    isQaTierOverride: false,
    qaOverride: null,
    subscriptionStatus: lastSub?.status ?? null,
    stripeTrialEnd: lastSub?.trial_end ?? null,
  }
}

