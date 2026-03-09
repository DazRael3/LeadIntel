export type PlanId = 'starter' | 'closer' | 'closer_plus' | 'team'

export type CapabilityId =
  | 'sources_catalog'
  | 'sources_enrichment_snapshots'
  | 'webhooks'
  | 'exports'
  | 'crm_linkage'
  | 'verification_workflows'
  | 'growth_experiments'
  | 'platform_api'

export type CapabilityDefinition = {
  id: CapabilityId
  name: string
  description: string
  minPlan: PlanId
  notes?: string[]
}

