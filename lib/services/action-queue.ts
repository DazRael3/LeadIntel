import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActionQueueItem, ActionQueueStatus, ActionQueueType, ActionDestinationType } from '@/lib/domain/action-queue'

type DbRow = {
  id: string
  workspace_id: string
  created_by: string
  lead_id: string | null
  action_type: string
  status: string
  destination_type: string | null
  destination_id: string | null
  reason: string | null
  payload_meta: unknown
  error: string | null
  created_at: string
  updated_at: string
}

function isStatus(x: string): x is ActionQueueStatus {
  return x === 'ready' || x === 'queued' || x === 'processing' || x === 'delivered' || x === 'failed' || x === 'blocked' || x === 'manual_review'
}

function isType(x: string): x is ActionQueueType {
  return (
    x === 'crm_handoff_prepared' ||
    x === 'sequencer_handoff_prepared' ||
    x === 'webhook_delivery' ||
    x === 'export_delivery' ||
    x === 'manual_review_required'
  )
}

function isDest(x: string): x is ActionDestinationType {
  return x === 'webhook' || x === 'export' || x === 'internal'
}

function normalize(row: DbRow): ActionQueueItem {
  const status = isStatus(row.status) ? row.status : 'ready'
  const type = isType(row.action_type) ? row.action_type : 'manual_review_required'
  const destType = typeof row.destination_type === 'string' && isDest(row.destination_type) ? row.destination_type : null
  const payload_meta = (row.payload_meta && typeof row.payload_meta === 'object' ? (row.payload_meta as Record<string, unknown>) : {}) as Record<string, unknown>
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    created_by: row.created_by,
    lead_id: row.lead_id,
    action_type: type,
    status,
    destination_type: destType,
    destination_id: row.destination_id,
    reason: row.reason,
    payload_meta,
    error: row.error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function createActionQueueItem(args: {
  supabase: SupabaseClient
  workspaceId: string
  userId: string
  leadId: string | null
  actionType: ActionQueueType
  status?: ActionQueueStatus
  destinationType?: ActionDestinationType | null
  destinationId?: string | null
  reason?: string | null
  payloadMeta?: Record<string, unknown>
}): Promise<ActionQueueItem> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('action_queue_items')
    .insert({
      workspace_id: args.workspaceId,
      created_by: args.userId,
      lead_id: args.leadId,
      action_type: args.actionType,
      status: args.status ?? 'ready',
      destination_type: args.destinationType ?? null,
      destination_id: args.destinationId ?? null,
      reason: args.reason ?? null,
      payload_meta: args.payloadMeta ?? {},
    })
    .select('*')
    .single()
  if (error || !data) throw new Error('failed_to_create_queue_item')
  return normalize(data as unknown as DbRow)
}

export async function listActionQueueItems(args: {
  supabase: SupabaseClient
  workspaceId: string
  status?: ActionQueueStatus | 'all'
  limit: number
}): Promise<ActionQueueItem[]> {
  let q = args.supabase
    .schema('api')
    .from('action_queue_items')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false })
    .limit(args.limit)

  if (args.status && args.status !== 'all') q = q.eq('status', args.status)

  const { data } = await q
  return (data ?? []).map((r) => normalize(r as unknown as DbRow))
}

