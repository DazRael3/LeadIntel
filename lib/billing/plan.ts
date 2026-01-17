import type { SupabaseClient } from '@supabase/supabase-js'

const ACTIVE_STATUSES = ['active', 'trialing']

export type Plan = 'free' | 'pro'

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
