export type SourceAvailability = 'active' | 'configurable' | 'import_only' | 'webhook_only' | 'limited' | 'unavailable' | 'planned'

export type SourceSystemKind = 'first_party' | 'third_party' | 'manual' | 'internal'

export type SourceCapability =
  | 'signals'
  | 'citations'
  | 'first_party_intent'
  | 'news'
  | 'filings'
  | 'jobs'
  | 'enrichment_snapshot'
  | 'export_delivery'
  | 'webhook_delivery'
  | 'crm_observation'

export type SourceId =
  | 'first_party_visits'
  | 'trigger_events'
  | 'gdelt_news'
  | 'sec_filings'
  | 'jobs_boards'
  | 'webhooks'
  | 'exports'
  | 'crm_observations'
  | 'manual_outcomes'

export type SourceDefinition = {
  id: SourceId
  name: string
  description: string
  kind: SourceSystemKind
  availability: SourceAvailability
  capabilities: SourceCapability[]
  docs?: { title: string; path: string }
  governanceNotes: string[]
}

export type SourceRuntimeStatus = {
  id: SourceId
  configured: boolean
  notes: string[]
}

