import type { SupabaseClient } from '@supabase/supabase-js'

export type ResolvedTier = 'starter' | 'closer'

export type TierResolution = {
  tier: ResolvedTier
  planId: 'pro' | null
  subscriptionStatus: string | null
  stripeTrialEnd: string | null
}

function isActiveStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing'
}

function isMissingColumnError(error: unknown): boolean {
  // Postgres undefined_column is 42703; PostgREST wraps it as text in message/details.
  const e = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }
  if (e?.code === '42703') return true
  const msg = String(e?.message ?? '')
  const details = String(e?.details ?? '')
  return msg.includes('does not exist') || details.includes('does not exist')
}

/**
 * Resolve the effective product tier from canonical billing sources in the `api` schema.
 *
 * Source of truth:
 * - Active subscription row in `api.subscriptions` => closer
 * - Fallback marker `api.users.subscription_tier === 'pro'` => closer
 * - Else => starter
 *
 * Notes:
 * - Caller should provide a Supabase client already scoped to the `api` schema.
 * - This function is tolerant of older schemas (missing columns) by falling back to narrower selects.
 */
export async function resolveTierFromDb(admin: SupabaseClient, userId: string): Promise<TierResolution> {
  // 1) Subscription row (preferred)
  let subscriptionStatus: string | null = null
  let stripeTrialEnd: string | null = null

  try {
    const sub = await admin
      .from('subscriptions')
      .select('status, trial_end, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sub.error) {
      subscriptionStatus = (sub.data as { status?: string | null } | null)?.status ?? null
      stripeTrialEnd = (sub.data as { trial_end?: string | null } | null)?.trial_end ?? null
    } else if (isMissingColumnError(sub.error)) {
      // Older schema fallback: trial_end may not exist yet.
      const sub2 = await admin
        .from('subscriptions')
        .select('status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!sub2.error) {
        subscriptionStatus = (sub2.data as { status?: string | null } | null)?.status ?? null
        stripeTrialEnd = null
      }
    }
  } catch {
    // fail-open: treat as no subscription
    subscriptionStatus = null
    stripeTrialEnd = null
  }

  if (isActiveStatus(subscriptionStatus)) {
    return { tier: 'closer', planId: 'pro', subscriptionStatus, stripeTrialEnd }
  }

  // 2) User marker fallback
  try {
    const user = await admin.from('users').select('subscription_tier').eq('id', userId).maybeSingle()
    if (!user.error) {
      const marker = (user.data as { subscription_tier?: string | null } | null)?.subscription_tier ?? null
      if (marker === 'pro') {
        return { tier: 'closer', planId: 'pro', subscriptionStatus, stripeTrialEnd }
      }
    } else if (isMissingColumnError(user.error)) {
      // If the marker column doesn't exist yet, there is no safe fallback.
      return { tier: 'starter', planId: null, subscriptionStatus, stripeTrialEnd }
    }
  } catch {
    // ignore
  }

  return { tier: 'starter', planId: null, subscriptionStatus, stripeTrialEnd }
}

