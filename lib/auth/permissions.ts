import type { WorkspaceRole } from '@/lib/domain/roles'

export type WorkspacePermission =
  | 'workspace.manage_settings'
  | 'workspace.manage_members'
  | 'workspace.manage_integrations'
  | 'workspace.manage_templates'
  | 'workspace.approve_assets'
  | 'workspace.view_audit'
  | 'workspace.view_activity'
  | 'workspace.view_delivery_history'
  | 'workspace.manage_recipes'
  | 'workspace.assign_work'
  | 'workspace.comment'
  | 'workspace.resolve_threads'
  | 'workspace.submit_for_review'
  | 'workspace.review_assets'

const ROLE_PERMS: Record<WorkspaceRole, ReadonlySet<WorkspacePermission>> = {
  owner: new Set([
    'workspace.manage_settings',
    'workspace.manage_members',
    'workspace.manage_integrations',
    'workspace.manage_templates',
    'workspace.approve_assets',
    'workspace.view_audit',
    'workspace.view_activity',
    'workspace.view_delivery_history',
    'workspace.manage_recipes',
    'workspace.assign_work',
    'workspace.comment',
    'workspace.resolve_threads',
    'workspace.submit_for_review',
    'workspace.review_assets',
  ]),
  admin: new Set([
    'workspace.manage_settings',
    'workspace.manage_members',
    'workspace.manage_integrations',
    'workspace.manage_templates',
    'workspace.approve_assets',
    'workspace.view_audit',
    'workspace.view_activity',
    'workspace.view_delivery_history',
    'workspace.manage_recipes',
    'workspace.assign_work',
    'workspace.comment',
    'workspace.resolve_threads',
    'workspace.submit_for_review',
    'workspace.review_assets',
  ]),
  manager: new Set([
    'workspace.manage_templates',
    'workspace.approve_assets',
    'workspace.view_audit',
    'workspace.view_activity',
    'workspace.view_delivery_history',
    'workspace.manage_recipes',
    'workspace.assign_work',
    'workspace.comment',
    'workspace.resolve_threads',
    'workspace.submit_for_review',
    'workspace.review_assets',
  ]),
  rep: new Set([
    'workspace.view_activity',
    'workspace.view_delivery_history',
    'workspace.comment',
    'workspace.submit_for_review',
  ]),
  viewer: new Set(['workspace.view_activity', 'workspace.view_delivery_history', 'workspace.comment']),
}

export function hasWorkspacePermission(role: WorkspaceRole, perm: WorkspacePermission): boolean {
  return ROLE_PERMS[role].has(perm)
}

