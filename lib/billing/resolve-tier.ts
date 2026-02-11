import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

export type Tier = 'starter' | 'closer'

export type ResolvedTier = {
  tier: Tier
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
  userId: string
): Promise<ResolvedTier> {
  const loadUser = async (): Promise<{ userRow: { subscription_tier?: string | null } | null; userError: PostgrestError | null }> => {
    const { data: userRow, error: userError } = await admin
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle()

    if (is42703(userError)) {
      // Older schema fallback: column missing. Re-run a minimal select to confirm row existence.
      await admin.from('users').select('id').eq('id', userId).maybeSingle()
      return { userRow: null, userError }
    }

    warnNon42703('users', userError)
    return { userRow: (userRow as { subscription_tier?: string | null } | null) ?? null, userError }
  }

  const loadSubs = async (): Promise<{
    subsRows: Array<{ status?: string | null; trial_end?: string | null; created_at?: string | null }> | null
    subsError: PostgrestError | null
  }> => {
    const { data: subsRows, error: subsError } = await admin
      .from('subscriptions')
      .select('status, trial_end, created_at')
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
        subsRows: Array.isArray(retry.data) ? (retry.data as Array<{ status?: string | null; created_at?: string | null }>) : [],
        subsError: subsError,
      }
    }

    warnNon42703('subscriptions', subsError)
    return {
      subsRows: Array.isArray(subsRows)
        ? (subsRows as Array<{ status?: string | null; trial_end?: string | null; created_at?: string | null }>)
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
  const lastSub = (subsRows?.[0] ?? null) as { status?: string | null; trial_end?: string | null } | null

  // d) Tier decision rules
  if (lastSub && (lastSub.status === 'active' || lastSub.status === 'trialing')) {
    return {
      tier: 'closer',
      subscriptionStatus: lastSub.status,
      stripeTrialEnd: lastSub.trial_end ?? null,
    }
  }

  if (userRow?.subscription_tier === 'pro') {
    return {
      tier: 'closer',
      subscriptionStatus: lastSub?.status ?? null,
      stripeTrialEnd: lastSub?.trial_end ?? null,
    }
  }

  return {
    tier: 'starter',
    subscriptionStatus: lastSub?.status ?? null,
    stripeTrialEnd: lastSub?.trial_end ?? null,
  }
}

