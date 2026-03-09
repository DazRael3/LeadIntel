import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'
import type { WorkspaceRole } from '@/lib/team/workspace'

export function revenueIntelligenceEnabled(args: { policies: WorkspacePolicies; role: WorkspaceRole }): { ok: true } | { ok: false; reason: string } {
  if (!args.policies.revenueIntelligence.revenueIntelligenceEnabled) return { ok: false, reason: 'Revenue intelligence is disabled for this workspace' }
  if (!args.policies.revenueIntelligence.viewerRoles.includes(args.role)) return { ok: false, reason: 'Access restricted' }
  return { ok: true }
}

export function canVerifyRevenueLinkage(args: { policies: WorkspacePolicies; role: WorkspaceRole }): { ok: true } | { ok: false; reason: string } {
  if (!args.policies.revenueIntelligence.verificationWorkflowsEnabled) return { ok: false, reason: 'Verification workflows are disabled for this workspace' }
  if (!args.policies.revenueIntelligence.verifierRoles.includes(args.role)) return { ok: false, reason: 'Access restricted' }
  return { ok: true }
}

