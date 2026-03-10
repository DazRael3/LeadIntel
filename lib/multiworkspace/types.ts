import type { WorkspaceRole, WorkspaceRow } from '@/lib/team/workspace'

export type MembershipSource = 'direct' | 'delegated'

export type WorkspaceAccess = {
  workspace: Pick<WorkspaceRow, 'id' | 'name' | 'owner_user_id' | 'created_at' | 'default_template_set_id'>
  role: WorkspaceRole
  source: MembershipSource
}

export type WorkspaceContext = {
  currentWorkspaceId: string
  role: WorkspaceRole
  source: MembershipSource
}

