import type { SupabaseClient } from '@supabase/supabase-js'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'

export async function getActiveWorkspaceIdForUser(args: {
  supabase: SupabaseClient
  userId: string
}): Promise<{ ok: true; workspaceId: string } | { ok: false; reason: 'workspace_missing' | 'forbidden' }> {
  await ensurePersonalWorkspace({ supabase: args.supabase, userId: args.userId })
  const ws = await getCurrentWorkspace({ supabase: args.supabase, userId: args.userId })
  if (!ws) return { ok: false, reason: 'workspace_missing' }
  const membership = await getWorkspaceMembership({ supabase: args.supabase, workspaceId: ws.id, userId: args.userId })
  if (!membership) return { ok: false, reason: 'forbidden' }
  return { ok: true, workspaceId: ws.id }
}

type WatchlistRow = {
  id: string
  name: string
  description: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

type WatchlistItemRow = {
  id: string
  watchlist_id: string
  lead_id: string
  note: string | null
  reminder_at: string | null
  reminder_status: string
  reminder_last_shown_at: string | null
  created_at: string
  updated_at: string
  leads?: {
    id: string
    company_name: string | null
    company_domain: string | null
    company_url: string | null
    created_at: string | null
  } | null
}

function isReminderStatus(v: unknown): v is 'none' | 'scheduled' | 'shown' | 'dismissed' | 'completed' {
  return v === 'none' || v === 'scheduled' || v === 'shown' || v === 'dismissed' || v === 'completed'
}

export async function listWatchlists(args: {
  supabase: SupabaseClient
  workspaceId: string
}): Promise<WatchlistRow[]> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('watchlists')
    .select('id, name, description, is_default, created_at, updated_at')
    .eq('workspace_id', args.workspaceId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) return []
  return (data ?? []) as unknown as WatchlistRow[]
}

export async function ensureDefaultWatchlist(args: {
  supabase: SupabaseClient
  workspaceId: string
  createdBy: string
}): Promise<{ ok: true; watchlistId: string } | { ok: false; reason: 'write_failed' }> {
  // 1) Attempt read existing default.
  const { data: existing } = await args.supabase
    .schema('api')
    .from('watchlists')
    .select('id')
    .eq('workspace_id', args.workspaceId)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle()

  const existingId = (existing as { id?: unknown } | null)?.id
  if (typeof existingId === 'string' && existingId) return { ok: true, watchlistId: existingId }

  // 2) Create default. If a concurrent insert happened, fall back to re-read.
  const { data, error } = await args.supabase
    .schema('api')
    .from('watchlists')
    .insert(
      {
        workspace_id: args.workspaceId,
        name: 'Default',
        description: 'Primary watchlist for this workspace.',
        is_default: true,
        created_by: args.createdBy,
      } as never,
      { count: 'exact' }
    )
    .select('id')
    .single()

  if (!error) {
    const id = (data as { id?: unknown } | null)?.id
    if (typeof id === 'string' && id) return { ok: true, watchlistId: id }
  }

  const { data: retry } = await args.supabase
    .schema('api')
    .from('watchlists')
    .select('id')
    .eq('workspace_id', args.workspaceId)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle()

  const retryId = (retry as { id?: unknown } | null)?.id
  if (typeof retryId === 'string' && retryId) return { ok: true, watchlistId: retryId }
  return { ok: false, reason: 'write_failed' }
}

export async function listWatchlistItems(args: {
  supabase: SupabaseClient
  workspaceId: string
  watchlistId: string
  limit?: number
}): Promise<Array<{ row: WatchlistItemRow; reminderStatus: WatchlistItemRow['reminder_status'] }>> {
  const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 100)))
  const { data, error } = await args.supabase
    .schema('api')
    .from('watchlist_items')
    .select('id, watchlist_id, lead_id, note, reminder_at, reminder_status, reminder_last_shown_at, created_at, updated_at, leads:leads(id, company_name, company_domain, company_url, created_at)')
    .eq('workspace_id', args.workspaceId)
    .eq('watchlist_id', args.watchlistId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  const rows = (data ?? []) as unknown as WatchlistItemRow[]
  return rows.map((r) => ({ row: r, reminderStatus: isReminderStatus(r.reminder_status) ? r.reminder_status : 'none' }))
}

export async function addLeadToWatchlist(args: {
  supabase: SupabaseClient
  workspaceId: string
  watchlistId: string
  userId: string
  leadId: string
}): Promise<{ ok: true } | { ok: false; reason: 'conflict' | 'write_failed' }> {
  const { error } = await args.supabase
    .schema('api')
    .from('watchlist_items')
    .insert(
      {
        workspace_id: args.workspaceId,
        watchlist_id: args.watchlistId,
        lead_id: args.leadId,
        added_by: args.userId,
        reminder_status: 'none',
      } as never,
      { count: 'exact' }
    )

  if (!error) return { ok: true }
  if ((error as { code?: string } | null)?.code === '23505') return { ok: false, reason: 'conflict' }
  return { ok: false, reason: 'write_failed' }
}

export async function removeLeadFromWatchlist(args: {
  supabase: SupabaseClient
  workspaceId: string
  watchlistId: string
  leadId: string
}): Promise<{ ok: true } | { ok: false; reason: 'write_failed' }> {
  const { error } = await args.supabase
    .schema('api')
    .from('watchlist_items')
    .delete()
    .eq('workspace_id', args.workspaceId)
    .eq('watchlist_id', args.watchlistId)
    .eq('lead_id', args.leadId)

  if (error) return { ok: false, reason: 'write_failed' }
  return { ok: true }
}

export async function updateWatchlistItem(args: {
  supabase: SupabaseClient
  workspaceId: string
  itemId: string
  patch: {
    note?: string | null
    reminder_at?: string | null
    reminder_status?: 'none' | 'scheduled' | 'shown' | 'dismissed' | 'completed'
    reminder_last_shown_at?: string | null
  }
}): Promise<{ ok: true } | { ok: false; reason: 'write_failed' }> {
  const { error } = await args.supabase
    .schema('api')
    .from('watchlist_items')
    .update({ ...args.patch, updated_at: new Date().toISOString() } as never)
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.itemId)

  if (error) return { ok: false, reason: 'write_failed' }
  return { ok: true }
}

