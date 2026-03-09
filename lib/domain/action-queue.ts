export type ActionQueueStatus = 'ready' | 'queued' | 'processing' | 'delivered' | 'failed' | 'blocked' | 'manual_review'

export type ActionQueueType =
  | 'crm_handoff_prepared'
  | 'sequencer_handoff_prepared'
  | 'webhook_delivery'
  | 'export_delivery'
  | 'manual_review_required'

export type ActionDestinationType = 'webhook' | 'export' | 'internal'

export type ActionQueueItem = {
  id: string
  workspace_id: string
  created_by: string
  lead_id: string | null
  action_type: ActionQueueType
  status: ActionQueueStatus
  destination_type: ActionDestinationType | null
  destination_id: string | null
  reason: string | null
  payload_meta: Record<string, unknown>
  error: string | null
  created_at: string
  updated_at: string
}

