import type { SupabaseClient } from '@supabase/supabase-js'

const ACTIVE_STATUSES = ['active', 'trialing']

export type Plan = 'free' | 'pro'

export interface PlanDetails {
  plan: Plan
  /** Subscription status if known (from api.subscriptions). */
  subscriptionStatus?: string | null
  /** Trial end timestamp (ISO) if known and user is trialing. */
  trialEndsAt?: string | null
  /** Current period end timestamp (ISO) if known. */
  currentPeriodEndsAt?: string | null
  /** App-level trial end timestamp (ISO) if enabled and active. */
  appTrialEndsAt?: string | null
  /** True when effective Pro access is coming from app-level trial (not Stripe). */
  isAppTrial?: boolean
}

function isAppTrialEnabled(): boolean {
  const raw = (process.env.ENABLE_APP_TRIAL || '').trim().toLowerCase()
  return raw === '1' || raw === 'true'
}

function isFutureIso(ts: string | null | undefined, nowMs: number): boolean {
  if (!ts) return false
  const ms = Date.parse(ts)
  return Number.isFinite(ms) && ms > nowMs
}

export async function getPlan(supabase: SupabaseClient, userId: string): Promise<Plan> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .in('status', ACTIVE_STATUSES)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sub && ACTIVE_STATUSES.includes(sub.status)) {
    return 'pro'
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle()

  if (userRow?.subscription_tier === 'pro') {
    return 'pro'
  }

  return 'free'
}

export async function isPro(supabase: SupabaseClient, userId: string): Promise<boolean> {
  return (await getPlan(supabase, userId)) === 'pro'
}

/**
 * Fetch richer plan details for UI (plan + trial info).
 *
 * Important: This function is resilient to schema drift (missing columns) and will
 * fall back to `getPlan()` if advanced fields are unavailable.
 */
export async function getPlanDetails(supabase: SupabaseClient, userId: string): Promise<PlanDetails> {
  // Try to read richer subscription fields (these may be added by later migrations).
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, trial_end, current_period_end')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const status = (sub as { status?: string | null } | null)?.status ?? null
    let plan: Plan = status && ACTIVE_STATUSES.includes(status) ? 'pro' : await getPlan(supabase, userId)
    let appTrialEndsAt: string | null = null
    let isAppTrial = false

    if (plan === 'free' && isAppTrialEnabled()) {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('trial_ends_at')
          .eq('id', userId)
          .maybeSingle()

        const trialEnds = (userRow as { trial_ends_at?: string | null } | null)?.trial_ends_at ?? null
        if (isFutureIso(trialEnds, Date.now())) {
          plan = 'pro'
          appTrialEndsAt = trialEnds
          isAppTrial = true
        }
      } catch {
        // If columns are missing, treat as no app trial (schema drift tolerance).
      }
    }

    return {
      plan,
      subscriptionStatus: status,
      trialEndsAt: (sub as { trial_end?: string | null } | null)?.trial_end ?? null,
      currentPeriodEndsAt: (sub as { current_period_end?: string | null } | null)?.current_period_end ?? null,
      appTrialEndsAt,
      isAppTrial,
    }
  } catch {
    const plan = await getPlan(supabase, userId)
    return { plan }
  }
}
