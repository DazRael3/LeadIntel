import type { SupabaseClient } from '@supabase/supabase-js'

export type DeliveryStatus = 'queued' | 'processing' | 'delivered' | 'failed'

export type DeliveryHistoryRow = {
  id: string
  workspace_id: string
  queue_item_id: string | null
  actor_user_id: string
  action_type: string
  destination_type: 'webhook' | 'export'
  destination_id: string | null
  status: DeliveryStatus
  webhook_delivery_id: string | null
  export_job_id: string | null
  error: string | null
  meta: Record<string, unknown>
  created_at: string
}

type DbRow = {
  id: string
  workspace_id: string
  queue_item_id: string | null
  actor_user_id: string
  action_type: string
  destination_type: string
  destination_id: string | null
  status: string
  webhook_delivery_id: string | null
  export_job_id: string | null
  error: string | null
  meta: unknown
  created_at: string
}

function isStatus(x: string): x is DeliveryStatus {
  return x === 'queued' || x === 'processing' || x === 'delivered' || x === 'failed'
}

function isDest(x: string): x is 'webhook' | 'export' {
  return x === 'webhook' || x === 'export'
}

function normalize(r: DbRow): DeliveryHistoryRow {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    queue_item_id: r.queue_item_id,
    actor_user_id: r.actor_user_id,
    action_type: r.action_type,
    destination_type: isDest(r.destination_type) ? r.destination_type : 'webhook',
    destination_id: r.destination_id,
    status: isStatus(r.status) ? r.status : 'queued',
    webhook_delivery_id: r.webhook_delivery_id,
    export_job_id: r.export_job_id,
    error: r.error,
    meta: r.meta && typeof r.meta === 'object' ? (r.meta as Record<string, unknown>) : {},
    created_at: r.created_at,
  }
}

export async function listDeliveryHistory(args: { supabase: SupabaseClient; workspaceId: string; limit: number }): Promise<DeliveryHistoryRow[]> {
  const { data } = await args.supabase
    .schema('api')
    .from('action_deliveries')
    .select('id, workspace_id, queue_item_id, actor_user_id, action_type, destination_type, destination_id, status, webhook_delivery_id, export_job_id, error, meta, created_at')
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false })
    .limit(args.limit)
  return (data ?? []).map((r) => normalize(r as unknown as DbRow))
}

