import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'
import type { WorkspaceRole } from '@/lib/team/workspace'

export function canManageExperiments(args: { policies: WorkspacePolicies; role: WorkspaceRole }): boolean {
  return args.policies.growth.manageRoles.includes(args.role)
}

export function canViewGrowthInsights(args: { policies: WorkspacePolicies; role: WorkspaceRole }): boolean {
  return args.policies.growth.viewerRoles.includes(args.role)
}

