import type { ExperimentTargeting } from '@/lib/experiments/types'
import type { WorkspaceRole } from '@/lib/team/workspace'

export function matchesTargeting(args: {
  targeting: ExperimentTargeting
  workspaceRole: WorkspaceRole
  plan: string | null
  userId: string
}): boolean {
  const t = args.targeting

  if (Array.isArray(t.excludeUserIds) && t.excludeUserIds.includes(args.userId)) return false
  if (Array.isArray(t.includeUserIds) && t.includeUserIds.length > 0 && !t.includeUserIds.includes(args.userId)) return false

  if (Array.isArray(t.roles) && t.roles.length > 0 && !t.roles.includes(args.workspaceRole)) return false

  if (Array.isArray(t.plans) && t.plans.length > 0) {
    const p = (args.plan ?? '').trim()
    if (!p) return false
    if (!t.plans.includes(p)) return false
  }

  return true
}

