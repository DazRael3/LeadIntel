export type IntegrationFamily = 'webhook' | 'export' | 'crm' | 'sequencer' | 'playbooks' | 'internal'

export type IntegrationId =
  | 'webhooks'
  | 'exports'
  | 'crm_handoff'
  | 'sequencer_handoff'
  | 'team_playbooks'

export type IntegrationCapability = {
  acceptsAccountPush?: boolean
  acceptsTaskCreate?: boolean
  acceptsNoteCreate?: boolean
  acceptsSequenceHandoff?: boolean
  acceptsWebhookDelivery?: boolean
  acceptsExportDelivery?: boolean
  acceptsPlaybookSync?: boolean
  requiresOAuth?: boolean
  requiresWebhookEndpoint?: boolean
  requiresWorkspaceConfig?: boolean
}

export type ConnectionState = 'not_connected' | 'configured' | 'limited' | 'ready' | 'error'

export type IntegrationDescriptor = {
  id: IntegrationId
  family: IntegrationFamily
  name: string
  shortDescription: string
  setupHint: string
  capabilities: IntegrationCapability
  // Honesty: if we do not provide native auth, say how it works.
  implementation: 'native' | 'via_webhook' | 'via_export' | 'workspace_internal'
}

export type WorkspaceIntegrationStatus = {
  id: IntegrationId
  state: ConnectionState
  enabled: boolean
  blockingReason?: string
  detail?: string
}

export type WorkspaceIntegrationSummary = {
  workspaceId: string
  role: 'owner' | 'admin' | 'member'
  integrations: Array<IntegrationDescriptor & { status: WorkspaceIntegrationStatus }>
  defaults: {
    handoffWebhookEndpointId: string | null
  }
}

