import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveTierFromDb, type Tier } from '@/lib/billing/resolve-tier'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { isE2E } from '@/lib/runtimeFlags'

export type TeamGateResult =
  | { ok: true; tier: Tier }
  | { ok: false; tier: Tier }

export async function getUserTierForGating(args: {
  userId: string
  sessionEmail?: string | null
  supabase?: SupabaseClient
}): Promise<Tier> {
  // In production we resolve via admin client (RLS-safe).
  // In E2E we prefer the request-scoped client so cookie-based shims work.
  if (isE2E() && args.supabase) {
    const resolved = await resolveTierFromDb(args.supabase as unknown as SupabaseClient<any, 'api', any>, args.userId, args.sessionEmail ?? null)
    return resolved.tier
  }

  const admin = createSupabaseAdminClient({ schema: 'api' })
  const resolved = await resolveTierFromDb(admin as unknown as SupabaseClient<any, 'api', any>, args.userId, args.sessionEmail ?? null)
  return resolved.tier
}

export async function requireTeamPlan(args: {
  userId: string
  sessionEmail?: string | null
  supabase?: SupabaseClient
}): Promise<TeamGateResult> {
  const tier = await getUserTierForGating(args)
  if (tier === 'team') return { ok: true, tier }
  return { ok: false, tier }
}

