import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkspaceAccess, MembershipSource } from '@/lib/multiworkspace/types'
import type { WorkspaceRole, WorkspaceRow } from '@/lib/team/workspace'

type MembershipRow = {
  workspace_id: string
  role: WorkspaceRole
  membership_source: MembershipSource | null
  created_at: string | null
  workspaces: {
    id: string
    name: string
    owner_user_id: string
    default_template_set_id: string | null
    created_at: string
  } | null
}

function normalizeSource(v: unknown): MembershipSource {
  return v === 'delegated' ? 'delegated' : 'direct'
}

export async function listAccessibleWorkspaces(args: {
  supabase: SupabaseClient
  userId: string
}): Promise<WorkspaceAccess[]> {
  const { data } = await args.supabase
    .schema('api')
    .from('workspace_members')
    .select('workspace_id, role, membership_source, created_at, workspaces:workspaces(id, name, owner_user_id, default_template_set_id, created_at)')
    .eq('user_id', args.userId)
    .order('created_at', { ascending: true })
    .limit(200)

  const rows = (data ?? []) as unknown as MembershipRow[]
  const out: WorkspaceAccess[] = []
  for (const r of rows) {
    if (!r.workspaces) continue
    out.push({
      workspace: r.workspaces as unknown as WorkspaceRow,
      role: r.role,
      source: normalizeSource(r.membership_source),
    })
  }
  return out
}

