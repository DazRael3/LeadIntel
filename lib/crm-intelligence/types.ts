export type CrmSystem = 'generic'

export type VerificationLabel = 'verified' | 'probable' | 'possible' | 'ambiguous' | 'insufficient_evidence'

export type CrmMappingKind = 'account' | 'opportunity'
export type CrmMappingStatus = 'mapped' | 'ambiguous' | 'stale' | 'unmapped'
export type CrmMappingVerificationStatus = 'unverified' | 'verified' | 'ambiguous' | 'not_linked' | 'needs_review'

export type CrmObjectMapping = {
  id: string
  workspaceId: string
  accountId: string | null
  mappingKind: CrmMappingKind
  crmSystem: CrmSystem
  crmObjectId: string
  status: CrmMappingStatus
  verificationStatus: CrmMappingVerificationStatus
  reason: string | null
  meta: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedBy: string | null
  updatedAt: string
}

export type CrmOpportunityObservationSource = 'manual' | 'webhook'

export type CrmOpportunityObservation = {
  id: string
  workspaceId: string
  accountId: string | null
  opportunityMappingId: string | null
  crmSystem: CrmSystem
  opportunityId: string
  stage: string | null
  status: string | null
  observedAt: string
  source: CrmOpportunityObservationSource
  evidenceNote: string | null
  meta: Record<string, unknown>
  recordedBy: string
  createdAt: string
}

export type WorkflowEvent = {
  kind:
    | 'signal_detected'
    | 'account_prioritized'
    | 'handoff_prepared'
    | 'handoff_delivered'
    | 'approval_completed'
    | 'assignment_changed'
    | 'outcome_recorded'
  at: string
  summary: string
  meta?: Record<string, unknown>
}

export type DownstreamCrmEvent = {
  kind: 'crm_opportunity_observed'
  at: string
  summary: string
  crm: { system: CrmSystem; opportunityId: string; stage: string | null; status: string | null }
  evidenceNote: string | null
}

export type OpportunityContext = {
  type: 'opportunity_context'
  version: 'crm_intel_v1'
  workspaceId: string
  accountId: string
  crmSystem: CrmSystem
  accountMapping: CrmObjectMapping | null
  opportunities: CrmObjectMapping[]
  latestObservation: CrmOpportunityObservation | null
  verification: { label: VerificationLabel; note: string }
  limitationsNote: string
  computedAt: string
}

export type WorkflowToOutcomeLink = {
  type: 'workflow_to_outcome_link'
  version: 'linkage_v1'
  workspaceId: string
  accountId: string
  verification: { label: VerificationLabel; note: string }
  windowDays: number
  workflowEvents: WorkflowEvent[]
  downstreamEvents: DownstreamCrmEvent[]
  timingSummary: string
  ambiguityNote: string | null
  limitationsNote: string
  computedAt: string
}

export type AttributionSupportSummary = {
  type: 'attribution_support_summary'
  version: 'attrib_support_v1'
  workspaceId: string
  accountId: string
  label:
    | 'verified_downstream_support'
    | 'plausible_support'
    | 'ambiguous_support'
    | 'no_verified_support_yet'
    | 'insufficient_crm_data'
  verification: { label: VerificationLabel; note: string }
  whatIsVerified: string[]
  whatIsInferred: string[]
  whatIsMissing: string[]
  limitationsNote: string
  computedAt: string
}

