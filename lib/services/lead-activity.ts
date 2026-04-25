import type { SupabaseClient } from '@supabase/supabase-js'

export type ActivityCounts = {
  newLeadsSinceLastVisit: number
  campaignsAwaitingAction: number
}

type LastSeenRow = {
  last_lead_library_seen_at: string | null
}

async function getLastLeadLibrarySeenAt(args: {
  supabase: SupabaseClient
  userId: string
}): Promise<string | null> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('user_settings')
    .select('last_lead_library_seen_at')
    .eq('user_id', args.userId)
    .maybeSingle()

  if (error) throw error
  const row = (data ?? null) as LastSeenRow | null
  return row?.last_lead_library_seen_at ?? null
}

export async function stampLeadLibrarySeen(args: {
  supabase: SupabaseClient
  userId: string
  seenAt?: string
}): Promise<void> {
  const seenAt = args.seenAt ?? new Date().toISOString()
  const { error } = await args.supabase
    .schema('api')
    .from('user_settings')
    .upsert(
      {
        user_id: args.userId,
        last_lead_library_seen_at: seenAt,
        updated_at: seenAt,
      },
      { onConflict: 'user_id' }
    )

  if (error) throw error
}

export async function getActivityCounts(args: {
  supabase: SupabaseClient
  userId: string
  workspaceId: string
}): Promise<ActivityCounts> {
  const lastSeenAt = await getLastLeadLibrarySeenAt({
    supabase: args.supabase,
    userId: args.userId,
  })

  let newLeadsSinceLastVisit = 0
  const newLeadsQuery = args.supabase
    .schema('api')
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', args.userId)

  const { count: newLeadCount, error: newLeadError } = lastSeenAt
    ? await newLeadsQuery.gt('generated_at', lastSeenAt)
    : await newLeadsQuery
  if (newLeadError) throw newLeadError
  newLeadsSinceLastVisit = typeof newLeadCount === 'number' ? newLeadCount : 0

  const { count: awaitingCount, error: awaitingError } = await args.supabase
    .schema('api')
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', args.workspaceId)
    .in('status', ['new', 'contacted'])
  if (awaitingError) throw awaitingError

  return {
    newLeadsSinceLastVisit,
    campaignsAwaitingAction: typeof awaitingCount === 'number' ? awaitingCount : 0,
  }
}
