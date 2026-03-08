import type { SupabaseClient } from '@supabase/supabase-js'
import { getUserTierForGating } from '@/lib/team/gating'
import type { Tier } from '@/lib/billing/resolve-tier'

export const FREE_MAX_PREMIUM_GENERATIONS = 3 as const

export type PremiumGenerationUsage = {
  used: number
  limit: number
  remaining: number
  byType: { pitch: number; report: number }
}

export type PremiumGenerationCapabilities = {
  tier: Tier
  maxPremiumGenerations: number | null
  blurPremiumSections: boolean
  allowPremiumExport: boolean
  allowFullCopy: boolean
}

export function isFreeTier(tier: Tier): boolean {
  return tier === 'starter'
}

export async function getPremiumGenerationCapabilities(args: {
  supabase: SupabaseClient
  userId: string
  sessionEmail: string | null
}): Promise<PremiumGenerationCapabilities> {
  const tier = await getUserTierForGating({
    userId: args.userId,
    sessionEmail: args.sessionEmail,
    supabase: args.supabase,
  })

  if (tier === 'starter') {
    return {
      tier,
      maxPremiumGenerations: FREE_MAX_PREMIUM_GENERATIONS,
      blurPremiumSections: true,
      allowPremiumExport: false,
      allowFullCopy: false,
    }
  }

  return {
    tier,
    maxPremiumGenerations: null,
    blurPremiumSections: false,
    allowPremiumExport: tier === 'team',
    allowFullCopy: true,
  }
}

export async function getPremiumGenerationUsage(args: {
  supabase: SupabaseClient
  userId: string
}): Promise<PremiumGenerationUsage> {
  // Use the authenticated Supabase client (RLS-protected) to avoid requiring service role keys.
  // In environments where `schema('api')` is available, use it to keep behavior consistent.
  const client =
    (args.supabase as unknown as { schema?: (s: string) => SupabaseClient }).schema
      ? (args.supabase as unknown as { schema: (s: string) => SupabaseClient }).schema('api')
      : args.supabase

  const [pitchRes, reportRes] = await Promise.all([
    client
      .from('usage_events')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', args.userId)
      .eq('status', 'complete')
      .eq('object_type', 'pitch'),
    client
      .from('usage_events')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', args.userId)
      .eq('status', 'complete')
      .eq('object_type', 'report'),
  ])

  const pitch = typeof pitchRes.count === 'number' ? pitchRes.count : 0
  const report = typeof reportRes.count === 'number' ? reportRes.count : 0
  const used = pitch + report
  const limit = FREE_MAX_PREMIUM_GENERATIONS
  const remaining = Math.max(0, limit - used)

  return { used, limit, remaining, byType: { pitch, report } }
}

export function canGeneratePremiumAsset(args: {
  capabilities: PremiumGenerationCapabilities
  usage: PremiumGenerationUsage
}): { ok: true } | { ok: false; reason: 'FREE_TIER_GENERATION_LIMIT_REACHED' } {
  if (!isFreeTier(args.capabilities.tier)) return { ok: true }
  if (args.usage.used >= args.usage.limit) return { ok: false, reason: 'FREE_TIER_GENERATION_LIMIT_REACHED' }
  return { ok: true }
}

export async function reservePremiumGeneration(args: {
  supabase: SupabaseClient
  capabilities: PremiumGenerationCapabilities
}): Promise<{ ok: true; reservationId: string | null } | { ok: false }> {
  if (!isFreeTier(args.capabilities.tier)) return { ok: true, reservationId: null }
  const client =
    (args.supabase as unknown as { schema?: (s: string) => SupabaseClient }).schema
      ? (args.supabase as unknown as { schema: (s: string) => SupabaseClient }).schema('api')
      : args.supabase

  const { data, error } = await client.rpc('reserve_premium_generation', { expires_seconds: 900 })

  if (error) return { ok: false }
  const id = typeof data === 'string' ? data : null
  if (!id) return { ok: false }
  return { ok: true, reservationId: id }
}

export async function completePremiumGeneration(args: {
  supabase: SupabaseClient
  reservationId: string | null
  objectType: 'pitch' | 'report'
  objectId: string
}): Promise<void> {
  if (!args.reservationId) return
  const client = (args.supabase as unknown as { schema?: (s: string) => SupabaseClient }).schema
    ? (args.supabase as unknown as { schema: (s: string) => SupabaseClient }).schema('api')
    : args.supabase

  await client.rpc('complete_premium_generation', {
    p_reservation_id: args.reservationId,
    p_object_type: args.objectType,
    p_object_id: args.objectId,
  })
}

export async function cancelPremiumGeneration(args: {
  supabase: SupabaseClient
  reservationId: string | null
}): Promise<void> {
  if (!args.reservationId) return
  const client = (args.supabase as unknown as { schema?: (s: string) => SupabaseClient }).schema
    ? (args.supabase as unknown as { schema: (s: string) => SupabaseClient }).schema('api')
    : args.supabase

  await client.rpc('cancel_premium_generation', { p_reservation_id: args.reservationId })
}

export function redactTextPreview(text: string, maxChars: number): string {
  const t = text.trim()
  if (t.length <= maxChars) return t
  return t.slice(0, Math.max(0, maxChars - 3)) + '...'
}

