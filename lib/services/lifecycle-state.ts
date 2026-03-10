import type { SupabaseClient } from '@supabase/supabase-js'

export type LifecycleState =
  | 'signed_up'
  | 'onboarding_started'
  | 'activated'
  | 'adopting'
  | 'team_adopting'
  | 'expansion_candidate'
  | 'at_risk'
  | 'dormant'

type UserSettingsRow = {
  user_id: string
  onboarding_started_at?: string | null
  onboarding_completed?: boolean | null
  ideal_customer?: string | null
  what_you_sell?: string | null
}

function hasIcp(s: UserSettingsRow | null): boolean {
  return Boolean((s?.ideal_customer ?? '').trim() || (s?.what_you_sell ?? '').trim())
}

function daysSince(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  return (nowMs - ms) / (1000 * 60 * 60 * 24)
}

export async function deriveWorkspaceLifecycleSummary(args: {
  supabase: SupabaseClient
  workspaceId: string
  now?: Date
}): Promise<{
  counts: Record<LifecycleState, number>
  sampleSize: number
  note: string
}> {
  const now = args.now ?? new Date()
  const nowMs = now.getTime()

  const { data: members } = await args.supabase
    .schema('api')
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', args.workspaceId)
    .limit(500)

  const userIds = ((members ?? []) as Array<{ user_id?: unknown }>)
    .map((m) => (typeof m.user_id === 'string' ? m.user_id : null))
    .filter((x): x is string => Boolean(x))

  const counts: Record<LifecycleState, number> = {
    signed_up: 0,
    onboarding_started: 0,
    activated: 0,
    adopting: 0,
    team_adopting: 0,
    expansion_candidate: 0,
    at_risk: 0,
    dormant: 0,
  }

  if (userIds.length === 0) {
    return { counts, sampleSize: 0, note: 'No workspace members found.' }
  }

  const [{ data: settingsRows }, { data: lastEvents }] = await Promise.all([
    args.supabase
      .schema('api')
      .from('user_settings')
      .select('user_id, onboarding_started_at, onboarding_completed, ideal_customer, what_you_sell')
      .in('user_id', userIds)
      .limit(500),
    args.supabase
      .schema('api')
      .from('growth_events')
      .select('user_id, created_at')
      .eq('workspace_id', args.workspaceId)
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(2000),
  ])

  const settingsByUser = new Map<string, UserSettingsRow>()
  for (const r of (settingsRows ?? []) as unknown as UserSettingsRow[]) {
    if (typeof r.user_id === 'string') settingsByUser.set(r.user_id, r)
  }

  const lastActivityByUser = new Map<string, string>()
  for (const r of (lastEvents ?? []) as Array<{ user_id?: unknown; created_at?: unknown }>) {
    const uid = typeof r.user_id === 'string' ? r.user_id : null
    const at = typeof r.created_at === 'string' ? r.created_at : null
    if (!uid || !at) continue
    if (!lastActivityByUser.has(uid)) lastActivityByUser.set(uid, at)
  }

  // NOTE: We intentionally keep this heuristic bounded and honest.
  // It’s a workflow lifecycle state, not churn prediction.
  for (const uid of userIds) {
    const settings = settingsByUser.get(uid) ?? null
    const lastActivityAt = lastActivityByUser.get(uid) ?? null
    const lastDays = daysSince(lastActivityAt, nowMs)

    // Dormant if no activity in ~3 weeks (or no events logged yet).
    if (lastDays === null || lastDays >= 21) {
      counts.dormant += 1
      continue
    }

    // Basic activation heuristic reused across the product.
    // If ICP is set and they have at least some activity recently, treat as activated/adopting.
    const icp = hasIcp(settings)

    if (icp && Boolean(settings?.onboarding_completed)) {
      counts.activated += 1
      continue
    }

    if (settings?.onboarding_started_at) {
      // If they started but haven’t been active recently, flag at_risk.
      if (lastDays >= 7) {
        counts.at_risk += 1
        continue
      }
      counts.onboarding_started += 1
      continue
    }

    // Recently active but not clearly onboarded/activated.
    counts.signed_up += 1
  }

  return {
    counts,
    sampleSize: userIds.length,
    note: 'Lifecycle states are workflow heuristics derived from onboarding fields and recent growth events. Some states (team/expansion) are reserved for future signals and may remain 0 until instrumented. This is not churn prediction.',
  }
}

