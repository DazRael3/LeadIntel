import type { CapabilityDefinition, PlanId } from '@/lib/packaging/types'

export const CAPABILITIES: CapabilityDefinition[] = [
  {
    id: 'sources_catalog',
    name: 'Sources catalog',
    description: 'View source availability and configuration status (truthful, non-claimy).',
    minPlan: 'team',
  },
  {
    id: 'sources_enrichment_snapshots',
    name: 'Enrichment snapshots',
    description: 'Company source snapshots (best-effort, cached).',
    minPlan: 'closer_plus',
    notes: ['Coverage depends on configured providers and public source availability.'],
  },
  { id: 'webhooks', name: 'Webhooks', description: 'Workspace webhook destinations and delivery history.', minPlan: 'team' },
  { id: 'exports', name: 'Exports', description: 'Export jobs and delivery history.', minPlan: 'closer' },
  {
    id: 'crm_linkage',
    name: 'CRM linkage (manual)',
    description: 'Explicit CRM mapping + downstream observations (generic system, no vendor sync implied).',
    minPlan: 'team',
  },
  { id: 'verification_workflows', name: 'Verification workflows', description: 'Human verification of linkage and outcomes.', minPlan: 'team' },
  { id: 'growth_experiments', name: 'Experimentation governance', description: 'Growth experiments and rollout controls.', minPlan: 'team' },
  { id: 'platform_api', name: 'Platform API', description: 'Workspace-scoped API keys and versioned routes.', minPlan: 'team' },
]

const PLAN_ORDER: PlanId[] = ['starter', 'closer', 'closer_plus', 'team']

export function planAtLeast(plan: PlanId, min: PlanId): boolean {
  return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(min)
}

export function capabilityAvailable(plan: PlanId, capabilityId: CapabilityDefinition['id']): boolean {
  const cap = CAPABILITIES.find((c) => c.id === capabilityId)
  if (!cap) return false
  return planAtLeast(plan, cap.minPlan)
}

