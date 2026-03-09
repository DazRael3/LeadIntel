import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'

export type DeploymentChecklistItem = {
  id:
    | 'workspace_configured'
    | 'members_invited'
    | 'roles_assigned'
    | 'templates_present'
    | 'approval_policy_set'
    | 'destinations_configured'
    | 'recipes_reviewed'
    | 'trust_docs_reviewed'
    | 'export_policy_reviewed'
    | 'first_value_completed'
  title: string
  status: 'ready' | 'needs_attention'
  detail: string
  href: string
}

export type DeploymentReadiness = {
  workspaceId: string
  updatedAt: string
  policies: WorkspacePolicies
  items: DeploymentChecklistItem[]
}

function readyItem(args: Omit<DeploymentChecklistItem, 'status'>): DeploymentChecklistItem {
  return { ...args, status: 'ready' }
}
function needsItem(args: Omit<DeploymentChecklistItem, 'status'>): DeploymentChecklistItem {
  return { ...args, status: 'needs_attention' }
}

export async function getDeploymentReadiness(args: {
  supabase: SupabaseClient
  workspaceId: string
}): Promise<DeploymentReadiness> {
  const { policies } = await getWorkspacePolicies({ supabase: args.supabase, workspaceId: args.workspaceId })

  const [{ data: members }, { data: webhooks }, { data: recipes }, { data: templates }, { data: exportJobs }] = await Promise.all([
    args.supabase.schema('api').from('workspace_members').select('id, role').eq('workspace_id', args.workspaceId),
    args.supabase.schema('api').from('webhook_endpoints').select('id, enabled').eq('workspace_id', args.workspaceId),
    args.supabase.schema('api').from('action_recipes').select('id, enabled').eq('workspace_id', args.workspaceId),
    args.supabase.schema('api').from('templates').select('id, status').eq('workspace_id', args.workspaceId),
    args.supabase.schema('api').from('export_jobs').select('id, created_at').eq('workspace_id', args.workspaceId).limit(1),
  ])

  const memberCount = members?.length ?? 0
  const privilegedCount = (members ?? []).filter((m) => m.role === 'owner' || m.role === 'admin' || m.role === 'manager').length
  const webhooksEnabled = (webhooks ?? []).some((w) => w.enabled === true)
  const recipesEnabled = (recipes ?? []).some((r) => r.enabled === true)
  const hasTemplates = (templates ?? []).length > 0
  const approvalsExplicit = policies.handoffs.requireApproval === true || policies.invite.allowedDomains !== null || policies.exports.allowedRoles.length > 0
  const hasAnyExport = (exportJobs ?? []).length > 0

  const items: DeploymentChecklistItem[] = []

  items.push(
    memberCount > 0
      ? readyItem({
          id: 'workspace_configured',
          title: 'Workspace configured',
          detail: 'Workspace exists and membership is active.',
          href: '/settings/workspace',
        })
      : needsItem({
          id: 'workspace_configured',
          title: 'Workspace configured',
          detail: 'Workspace membership not found.',
          href: '/settings/workspace',
        })
  )

  items.push(
    memberCount >= 2
      ? readyItem({
          id: 'members_invited',
          title: 'Members invited',
          detail: `${memberCount} members in workspace.`,
          href: '/settings/team',
        })
      : needsItem({
          id: 'members_invited',
          title: 'Members invited',
          detail: 'Invite at least one teammate to run as a shared workspace.',
          href: '/settings/team',
        })
  )

  items.push(
    privilegedCount >= 1
      ? readyItem({
          id: 'roles_assigned',
          title: 'Roles assigned',
          detail: `${privilegedCount} privileged members (owner/admin/manager).`,
          href: '/settings/team',
        })
      : needsItem({
          id: 'roles_assigned',
          title: 'Roles assigned',
          detail: 'Assign at least one owner/admin/manager for governance.',
          href: '/settings/team',
        })
  )

  items.push(
    hasTemplates
      ? readyItem({
          id: 'templates_present',
          title: 'Templates/playbooks present',
          detail: 'Templates exist for consistent outbound.',
          href: '/settings/templates',
        })
      : needsItem({
          id: 'templates_present',
          title: 'Templates/playbooks present',
          detail: 'Create at least one shared template to standardize messaging.',
          href: '/settings/templates',
        })
  )

  items.push(
    approvalsExplicit
      ? readyItem({
          id: 'approval_policy_set',
          title: 'Approval policy set',
          detail: policies.handoffs.requireApproval ? 'Handoff approval is required.' : 'Approval policy reviewed.',
          href: '/settings/workspace',
        })
      : needsItem({
          id: 'approval_policy_set',
          title: 'Approval policy set',
          detail: 'Review workspace governance policies before go-live.',
          href: '/settings/workspace',
        })
  )

  items.push(
    webhooksEnabled
      ? readyItem({
          id: 'destinations_configured',
          title: 'Destinations configured',
          detail: 'At least one webhook destination is enabled.',
          href: '/settings/integrations',
        })
      : needsItem({
          id: 'destinations_configured',
          title: 'Destinations configured',
          detail: 'Configure at least one destination (webhook/export) for handoff delivery.',
          href: '/settings/integrations',
        })
  )

  items.push(
    recipesEnabled
      ? readyItem({
          id: 'recipes_reviewed',
          title: 'Action recipes reviewed',
          detail: 'At least one automation recipe is enabled.',
          href: '/settings/integrations',
        })
      : needsItem({
          id: 'recipes_reviewed',
          title: 'Action recipes reviewed',
          detail: 'Review recipes so workflow actions are predictable.',
          href: '/settings/integrations',
        })
  )

  items.push(
    readyItem({
      id: 'trust_docs_reviewed',
      title: 'Trust docs reviewed',
      detail: 'Trust Center provides public posture for buyers.',
      href: '/trust',
    })
  )

  items.push(
    readyItem({
      id: 'export_policy_reviewed',
      title: 'Export policy reviewed',
      detail: `Export roles: ${policies.exports.allowedRoles.join(', ')}`,
      href: '/settings/workspace',
    })
  )

  items.push(
    hasAnyExport
      ? readyItem({
          id: 'first_value_completed',
          title: 'First-value workflow completed',
          detail: 'Workspace has produced at least one export job.',
          href: '/settings/exports',
        })
      : needsItem({
          id: 'first_value_completed',
          title: 'First-value workflow completed',
          detail: 'Run one workflow end-to-end to validate your setup.',
          href: '/dashboard',
        })
  )

  return { workspaceId: args.workspaceId, updatedAt: new Date().toISOString(), policies, items }
}

