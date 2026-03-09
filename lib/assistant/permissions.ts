import type { WorkspaceRole } from '@/lib/team/workspace'
import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'

export function assistantEnabledFor(args: { policies: WorkspacePolicies; role: WorkspaceRole }): { ok: boolean; reason: string } {
  if (!args.policies.assistant.assistantEnabled) return { ok: false, reason: 'Assistant is disabled for this workspace.' }
  if (!args.policies.assistant.assistantViewerRoles.includes(args.role)) return { ok: false, reason: 'Access restricted.' }
  return { ok: true, reason: 'ok' }
}

export function assistantActionsAllowed(args: { policies: WorkspacePolicies; role: WorkspaceRole }): boolean {
  if (!args.policies.assistant.assistantEnabled) return false
  if (!args.policies.assistant.assistantActionsEnabled) return false
  return args.policies.assistant.assistantActionRoles.includes(args.role)
}

