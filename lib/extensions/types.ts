export type ExtensionDestinationType = 'webhook'

export type CustomActionDefinition = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  destination_type: ExtensionDestinationType
  endpoint_id: string
  payload_template: Record<string, unknown>
  is_enabled: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export type CustomActionRunContext = {
  workspaceId: string
  account: {
    id: string
    lead_id: string | null
    name: string | null
    domain: string | null
    program_state: string
  }
  computedAt: string
}

