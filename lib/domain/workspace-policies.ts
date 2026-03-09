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
  planning: {
    planningIntelligenceEnabled: boolean
    teamInfluenceSummariesEnabled: boolean
    outcomeInformedPlanningEnabled: boolean
  }
  benchmarks: {
    benchmarksEnabled: boolean
    crossWorkspaceInsightsEnabled: boolean
    priorPeriodEnabled: boolean
    viewerRoles: WorkspaceRole[]
  }
  platform: {
    apiAccessEnabled: boolean
    embedEnabled: boolean
    extensionsEnabled: boolean
    apiKeyManageRoles: WorkspaceRole[]
    allowedKeyScopes: string[]
  }
  reporting: {
    executiveEnabled: boolean
    commandCenterEnabled: boolean
    snapshotsEnabled: boolean
    executiveViewerRoles: WorkspaceRole[]
    commandViewerRoles: WorkspaceRole[]
    mobileQuickActionsEnabled: boolean
  }
  assistant: {
    assistantEnabled: boolean
    proactiveNudgesEnabled: boolean
    assistantActionsEnabled: boolean
    assistantThreadsEnabled: boolean
    assistantActionRoles: WorkspaceRole[]
    assistantViewerRoles: WorkspaceRole[]
  }
  growth: {
    experimentsEnabled: boolean
    exposureLoggingEnabled: boolean
    manageRoles: WorkspaceRole[]
    viewerRoles: WorkspaceRole[]
    protectedSurfaces: string[]
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
  planning: z
    .object({
      planningIntelligenceEnabled: z.boolean().default(true),
      teamInfluenceSummariesEnabled: z.boolean().default(true),
      outcomeInformedPlanningEnabled: z.boolean().default(true),
    })
    .default({
      planningIntelligenceEnabled: true,
      teamInfluenceSummariesEnabled: true,
      outcomeInformedPlanningEnabled: true,
    }),
  benchmarks: z
    .object({
      benchmarksEnabled: z.boolean().default(true),
      crossWorkspaceInsightsEnabled: z.boolean().default(false),
      priorPeriodEnabled: z.boolean().default(true),
      viewerRoles: z.array(WorkspaceRoleSchema).min(1).default(['owner', 'admin', 'manager']),
    })
    .default({
      benchmarksEnabled: true,
      crossWorkspaceInsightsEnabled: false,
      priorPeriodEnabled: true,
      viewerRoles: ['owner', 'admin', 'manager'],
    }),
  platform: z
    .object({
      apiAccessEnabled: z.boolean().default(false),
      embedEnabled: z.boolean().default(false),
      extensionsEnabled: z.boolean().default(false),
      apiKeyManageRoles: z.array(WorkspaceRoleSchema).min(1).default(['owner', 'admin', 'manager']),
      // Stored as strings to avoid tight coupling in policy schema; platform code validates against its allowlist.
      allowedKeyScopes: z.array(z.string()).default([
        'workspace.read',
        'accounts.read',
        'action_queue.read',
        'delivery.read',
        'benchmarks.read',
        'embed.token.create',
      ]),
    })
    .default({
      apiAccessEnabled: false,
      embedEnabled: false,
      extensionsEnabled: false,
      apiKeyManageRoles: ['owner', 'admin', 'manager'],
      allowedKeyScopes: ['workspace.read', 'accounts.read', 'action_queue.read', 'delivery.read', 'benchmarks.read', 'embed.token.create'],
    }),
  reporting: z
    .object({
      executiveEnabled: z.boolean().default(true),
      commandCenterEnabled: z.boolean().default(true),
      snapshotsEnabled: z.boolean().default(true),
      executiveViewerRoles: z.array(WorkspaceRoleSchema).min(1).default(['owner', 'admin', 'manager']),
      commandViewerRoles: z.array(WorkspaceRoleSchema).min(1).default(['owner', 'admin', 'manager']),
      mobileQuickActionsEnabled: z.boolean().default(true),
    })
    .default({
      executiveEnabled: true,
      commandCenterEnabled: true,
      snapshotsEnabled: true,
      executiveViewerRoles: ['owner', 'admin', 'manager'],
      commandViewerRoles: ['owner', 'admin', 'manager'],
      mobileQuickActionsEnabled: true,
    }),
  assistant: z
    .object({
      assistantEnabled: z.boolean().default(false),
      proactiveNudgesEnabled: z.boolean().default(false),
      assistantActionsEnabled: z.boolean().default(false),
      assistantThreadsEnabled: z.boolean().default(true),
      assistantActionRoles: z.array(WorkspaceRoleSchema).min(1).default(['owner', 'admin', 'manager']),
      assistantViewerRoles: z.array(WorkspaceRoleSchema).min(1).default(['owner', 'admin', 'manager', 'rep']),
    })
    .default({
      assistantEnabled: false,
      proactiveNudgesEnabled: false,
      assistantActionsEnabled: false,
      assistantThreadsEnabled: true,
      assistantActionRoles: ['owner', 'admin', 'manager'],
      assistantViewerRoles: ['owner', 'admin', 'manager', 'rep'],
    }),
  growth: z
    .object({
      experimentsEnabled: z.boolean().default(false),
      exposureLoggingEnabled: z.boolean().default(true),
      manageRoles: z.array(WorkspaceRoleSchema).min(1).default(['owner', 'admin']),
      viewerRoles: z.array(WorkspaceRoleSchema).min(1).default(['owner', 'admin', 'manager']),
      // Stored as strings to avoid tight coupling; experiment engine enforces an allowlist.
      protectedSurfaces: z.array(z.string()).default(['billing', 'security', 'governance', 'entitlements']),
    })
    .default({
      experimentsEnabled: false,
      exposureLoggingEnabled: true,
      manageRoles: ['owner', 'admin'],
      viewerRoles: ['owner', 'admin', 'manager'],
      protectedSurfaces: ['billing', 'security', 'governance', 'entitlements'],
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
    planning: { ...args.current.planning, ...(args.patch.planning ?? {}) },
    benchmarks: { ...args.current.benchmarks, ...(args.patch.benchmarks ?? {}) },
    platform: { ...args.current.platform, ...(args.patch.platform ?? {}) },
    reporting: { ...args.current.reporting, ...(args.patch.reporting ?? {}) },
    assistant: { ...args.current.assistant, ...(args.patch.assistant ?? {}) },
    growth: { ...args.current.growth, ...(args.patch.growth ?? {}) },
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

