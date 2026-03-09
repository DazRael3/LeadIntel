import type { SupabaseClient } from '@supabase/supabase-js'

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'rep' | 'viewer'

export type WorkspaceRow = {
  id: string
  name: string
  owner_user_id: string
  default_template_set_id: string | null
  created_at: string
}

export async function ensurePersonalWorkspace(args: {
  supabase: SupabaseClient
  userId: string
  name?: string
}): Promise<WorkspaceRow> {
  // 1) If user already owns a workspace, reuse it.
  const { data: owned } = await args.supabase
    .schema('api')
    .from('workspaces')
    .select('id, name, owner_user_id, default_template_set_id, created_at')
    .eq('owner_user_id', args.userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const ownedRow = (owned ?? null) as WorkspaceRow | null
  if (ownedRow) {
    // Ensure membership row exists (idempotent)
    await args.supabase.schema('api').from('workspace_members').upsert(
      {
        workspace_id: ownedRow.id,
        user_id: args.userId,
        role: 'owner',
      },
      { onConflict: 'workspace_id,user_id' }
    )
    // Best-effort: set current workspace for stable multi-workspace UX.
    try {
      await args.supabase.from('users').update({ current_workspace_id: ownedRow.id }).eq('id', args.userId)
    } catch {
      // ignore (schema drift / old environments)
    }
    return ownedRow
  }

  // 2) Create a new personal workspace (owner only).
  const name = (args.name ?? 'Workspace').trim() || 'Workspace'
  const { data: ws, error: wsError } = await args.supabase
    .schema('api')
    .from('workspaces')
    .insert({ name, owner_user_id: args.userId })
    .select('id, name, owner_user_id, default_template_set_id, created_at')
    .single()

  if (wsError || !ws) {
    throw new Error('Failed to create workspace')
  }

  // 3) Create membership for owner (idempotent).
  await args.supabase.schema('api').from('workspace_members').upsert(
    {
      workspace_id: (ws as WorkspaceRow).id,
      user_id: args.userId,
      role: 'owner',
    },
    { onConflict: 'workspace_id,user_id' }
  )

  // Best-effort: set current workspace for stable multi-workspace UX.
  try {
    await args.supabase.from('users').update({ current_workspace_id: (ws as WorkspaceRow).id }).eq('id', args.userId)
  } catch {
    // ignore (schema drift / old environments)
  }

  return ws as WorkspaceRow
}

export async function getWorkspaceMembership(args: {
  supabase: SupabaseClient
  workspaceId: string
  userId: string
}): Promise<{ role: WorkspaceRole } | null> {
  const { data } = await args.supabase
    .schema('api')
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', args.workspaceId)
    .eq('user_id', args.userId)
    .maybeSingle()

  const role = (data as { role?: unknown } | null)?.role
  // Back-compat: older schema uses 'member' which maps to 'rep'.
  if (role === 'member') return { role: 'rep' }
  if (role === 'owner' || role === 'admin' || role === 'manager' || role === 'rep' || role === 'viewer') return { role }
  return null
}

export async function getCurrentWorkspace(args: {
  supabase: SupabaseClient
  userId: string
}): Promise<WorkspaceRow | null> {
  // Multi-workspace: prefer persisted selection when valid.
  try {
    const { data: userRow } = await args.supabase.from('users').select('current_workspace_id').eq('id', args.userId).maybeSingle()
    const currentId = (userRow as { current_workspace_id?: unknown } | null)?.current_workspace_id
    if (typeof currentId === 'string' && currentId) {
      const membership = await getWorkspaceMembership({ supabase: args.supabase, workspaceId: currentId, userId: args.userId })
      if (membership) {
        const { data: ws } = await args.supabase
          .schema('api')
          .from('workspaces')
          .select('id, name, owner_user_id, default_template_set_id, created_at')
          .eq('id', currentId)
          .maybeSingle()
        if (ws) return ws as WorkspaceRow
      }
    }
  } catch {
    // ignore (schema drift / old environments)
  }

  // Fallback: prefer owned workspace when present, otherwise pick the oldest membership.
  const { data: owned } = await args.supabase
    .schema('api')
    .from('workspaces')
    .select('id, name, owner_user_id, default_template_set_id, created_at')
    .eq('owner_user_id', args.userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (owned) return owned as WorkspaceRow

  const { data: memberships } = await args.supabase
    .schema('api')
    .from('workspace_members')
    .select('workspace_id, created_at')
    .eq('user_id', args.userId)
    .order('created_at', { ascending: true })
    .limit(1)

  const wsId = (memberships?.[0] as { workspace_id?: string } | undefined)?.workspace_id
  if (!wsId) return null

  const { data: ws } = await args.supabase
    .schema('api')
    .from('workspaces')
    .select('id, name, owner_user_id, default_template_set_id, created_at')
    .eq('id', wsId)
    .maybeSingle()

  return (ws ?? null) as WorkspaceRow | null
}

