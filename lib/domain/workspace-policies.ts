import { z } from 'zod'
import type { WorkspaceRole } from '@/lib/team/workspace'

export type WorkspacePolicies = {
  invite: {
    allowedDomains: string[] | null
  }
  exports: {
    allowedRoles: WorkspaceRole[]
  }
  handoffs: {
    requireApproval: boolean
  }
  governance: {
    integrationsManageRoles: WorkspaceRole[]
    workflowAdminRoles: WorkspaceRole[]
  }
  intelligence: {
    adaptiveRecommendationsEnabled: boolean
    outcomeLearningEnabled: boolean
    feedbackAggregationEnabled: boolean
    outcomeSubmitRoles: WorkspaceRole[]
  }
}

export const WorkspaceRoleSchema = z.enum(['owner', 'admin', 'manager', 'rep', 'viewer'])

function normalizeDomains(domains: string[]): string[] {
  const out: string[] = []
  for (const raw of domains) {
    const v = raw.trim().toLowerCase()
    if (!v) continue
    // Basic sanity check: allow "example.com" shapes only.
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) continue
    out.push(v)
  }
  return Array.from(new Set(out)).slice(0, 50)
}

export const WorkspacePoliciesSchema = z.object({
  invite: z
    .object({
      allowedDomains: z.array(z.string()).transform(normalizeDomains).nullable(),
    })
    .default({ allowedDomains: null }),
  exports: z
    .object({
      // Default matches current repo behavior: exports are admin-controlled.
      allowedRoles: z.array(WorkspaceRoleSchema).min(1).default(['owner', 'admin']),
    })
    .default({ allowedRoles: ['owner', 'admin'] }),
  handoffs: z
    .object({
      requireApproval: z.boolean().default(false),
    })
    .default({ requireApproval: false }),
  governance: z
    .object({
      integrationsManageRoles: z.array(WorkspaceRoleSchema).min(1).default(['owner', 'admin', 'manager']),
      workflowAdminRoles: z.array(WorkspaceRoleSchema).min(1).default(['owner', 'admin', 'manager']),
    })
    .default({ integrationsManageRoles: ['owner', 'admin', 'manager'], workflowAdminRoles: ['owner', 'admin', 'manager'] }),
  intelligence: z
    .object({
      adaptiveRecommendationsEnabled: z.boolean().default(true),
      outcomeLearningEnabled: z.boolean().default(true),
      feedbackAggregationEnabled: z.boolean().default(true),
      outcomeSubmitRoles: z.array(WorkspaceRoleSchema).min(1).default(['owner', 'admin', 'manager', 'rep']),
    })
    .default({
      adaptiveRecommendationsEnabled: true,
      outcomeLearningEnabled: true,
      feedbackAggregationEnabled: true,
      outcomeSubmitRoles: ['owner', 'admin', 'manager', 'rep'],
    }),
})

export type WorkspacePoliciesPatch = z.infer<typeof WorkspacePoliciesPatchSchema>
export const WorkspacePoliciesPatchSchema = WorkspacePoliciesSchema.partial()

export function defaultWorkspacePolicies(): WorkspacePolicies {
  return WorkspacePoliciesSchema.parse({})
}

export function mergeWorkspacePolicies(args: { current: WorkspacePolicies; patch: WorkspacePoliciesPatch }): WorkspacePolicies {
  const merged = {
    invite: { ...args.current.invite, ...(args.patch.invite ?? {}) },
    exports: { ...args.current.exports, ...(args.patch.exports ?? {}) },
    handoffs: { ...args.current.handoffs, ...(args.patch.handoffs ?? {}) },
    governance: { ...args.current.governance, ...(args.patch.governance ?? {}) },
    intelligence: { ...args.current.intelligence, ...(args.patch.intelligence ?? {}) },
  }
  return WorkspacePoliciesSchema.parse(merged)
}

export function inviteDomainForEmail(email: string): string | null {
  const v = email.trim().toLowerCase()
  const parts = v.split('@')
  if (parts.length !== 2) return null
  const dom = (parts[1] ?? '').trim()
  if (!dom) return null
  return dom
}

export function isInviteAllowed(args: { policies: WorkspacePolicies; email: string }): boolean {
  const dom = inviteDomainForEmail(args.email)
  if (!dom) return false
  const allowed = args.policies.invite.allowedDomains
  if (!allowed || allowed.length === 0) return true
  return allowed.includes(dom)
}

