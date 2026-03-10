import type { WorkspaceRole } from '@/lib/domain/roles'
import { hasWorkspacePermission, type WorkspacePermission } from '@/lib/auth/permissions'

export function requireWorkspacePermission(args: { role: WorkspaceRole; permission: WorkspacePermission }): { ok: true } | { ok: false; reason: string } {
  if (hasWorkspacePermission(args.role, args.permission)) return { ok: true }
  return { ok: false, reason: 'Access restricted' }
}

