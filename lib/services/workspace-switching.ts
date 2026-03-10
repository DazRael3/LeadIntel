import type { SupabaseClient } from '@supabase/supabase-js'
import { getWorkspaceMembership } from '@/lib/team/workspace'

export async function setCurrentWorkspace(args: {
  supabase: SupabaseClient
  userId: string
  workspaceId: string
}): Promise<{ ok: true } | { ok: false; reason: 'not_member' | 'unavailable' }> {
  const membership = await getWorkspaceMembership({ supabase: args.supabase, workspaceId: args.workspaceId, userId: args.userId })
  if (!membership) return { ok: false, reason: 'not_member' }

  // Persist selection in api.users (schema drift tolerant).
  try {
    const { error } = await args.supabase.from('users').update({ current_workspace_id: args.workspaceId }).eq('id', args.userId)
    if (error) return { ok: false, reason: 'unavailable' }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  return { ok: true }
}

