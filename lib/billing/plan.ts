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
    const plan: Plan = status && ACTIVE_STATUSES.includes(status) ? 'pro' : await getPlan(supabase, userId)

    return {
      plan,
      subscriptionStatus: status,
      trialEndsAt: (sub as { trial_end?: string | null } | null)?.trial_end ?? null,
      currentPeriodEndsAt: (sub as { current_period_end?: string | null } | null)?.current_period_end ?? null,
    }
  } catch {
    const plan = await getPlan(supabase, userId)
    return { plan }
  }
}
