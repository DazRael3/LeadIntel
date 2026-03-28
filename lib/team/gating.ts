import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveTierFromDb, type Tier } from '@/lib/billing/resolve-tier'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { isE2E } from '@/lib/runtimeFlags'
import { hasSupabaseServiceRoleConfigured } from '@/lib/config/runtimeEnv'

export type TeamGateResult =
  | { ok: true; tier: Tier }
  | { ok: false; tier: Tier }

export async function getUserTierForGating(args: {
  userId: string
  sessionEmail?: string | null
  supabase?: SupabaseClient
}): Promise<Tier> {
  // Prefer request-scoped Supabase when available. This keeps gated pages resilient
  // even when service-role config is temporarily missing/misconfigured.
  //
  // Note: RLS allows users to read their own billing rows (api.users / api.subscriptions),
  // so using the request client does not weaken entitlements.
  if (args.supabase) {
    // IMPORTANT: Tier/billing state is stored in the `api` schema. Some environments
    // intentionally configure the default request client schema to `public` for other
    // surfaces. Ensure we always query `api` here to avoid fail-soft "starter" tier
    // resolution for paid users due to schema mismatch.
    const schemaClient =
      (args.supabase as unknown as { schema?: (s: string) => SupabaseClient }).schema
        ? (args.supabase as unknown as { schema: (s: string) => SupabaseClient }).schema('api')
        : args.supabase
    const resolved = await resolveTierFromDb(schemaClient as unknown as SupabaseClient<any, 'api', any>, args.userId, args.sessionEmail ?? null)
    return resolved.tier
  }

  // In E2E runs, use in-memory shims (admin client).
  if (isE2E()) {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const resolved = await resolveTierFromDb(admin as unknown as SupabaseClient<any, 'api', any>, args.userId, args.sessionEmail ?? null)
    return resolved.tier
  }

  // Production fallback: admin client if configured; otherwise fail-soft to Starter.
  if (!hasSupabaseServiceRoleConfigured()) return 'starter'
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

