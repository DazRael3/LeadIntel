export type HealthLabel = 'limited' | 'usable' | 'strong'

export type AdoptionSignal = {
  key:
    | 'accounts_tracked'
    | 'actions_prepared'
    | 'actions_delivered'
    | 'outcomes_recorded'
    | 'approvals_used'
    | 'integrations_configured'
  label: string
  value: number
  windowDays: number
  observedAt: string
  note: string
}

export type AdoptionHealthSummary = {
  type: 'adoption_health_summary'
  version: 'adoption_v1'
  workspaceId: string
  windowDays: number
  health: HealthLabel
  reasonSummary: string
  signals: AdoptionSignal[]
  limitationsNote: string
  computedAt: string
}

