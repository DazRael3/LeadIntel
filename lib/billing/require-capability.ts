import type { SupabaseClient } from '@supabase/supabase-js'
import { getTierCapabilities, type CapabilityKey } from '@/lib/billing/capabilities'
import type { Tier } from '@/lib/billing/tier'
import { getUserTierForGating } from '@/lib/team/gating'

export type CapabilityGateResult =
  | { ok: true; tier: Tier }
  | { ok: false; tier: Tier }

export async function requireCapability(args: {
  userId: string
  sessionEmail?: string | null
  supabase: SupabaseClient
  capability: CapabilityKey
}): Promise<CapabilityGateResult> {
  const tier = await getUserTierForGating({
    userId: args.userId,
    sessionEmail: args.sessionEmail ?? null,
    supabase: args.supabase,
  })

  const allowed = getTierCapabilities(tier)[args.capability] === true
  return allowed ? { ok: true, tier } : { ok: false, tier }
}

