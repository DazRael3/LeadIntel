import type { PlatformObject } from '@/lib/platform-api/objects'

export type DeliveryRow = {
  id: string
  workspace_id: string
  queue_item_id: string | null
  action_type: string
  destination_type: string
  destination_id: string | null
  status: string
  webhook_delivery_id: string | null
  export_job_id: string | null
  error: string | null
  created_at: string
  meta: unknown
}

type DeliveryStatus = 'queued' | 'processing' | 'delivered' | 'failed'

function normalizeStatus(x: string): DeliveryStatus {
  const v = (x ?? '').toLowerCase()
  if (v === 'processing' || v === 'delivered' || v === 'failed') return v
  return 'queued'
}

function safeMeta(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}
}

export function serializeDelivery(row: DeliveryRow): PlatformObject<
  'delivery_event',
  {
    queue_item_id: string | null
    action_type: string
    destination_type: 'webhook' | 'export'
    destination_id: string | null
    status: DeliveryStatus
    webhook_delivery_id: string | null
    export_job_id: string | null
    error: string | null
    meta: Record<string, unknown>
  }
> {
  const dest = row.destination_type === 'export' ? 'export' : 'webhook'
  return {
    id: row.id,
    object: 'delivery_event',
    workspace_id: row.workspace_id,
    created_at: row.created_at ?? null,
    updated_at: null,
    attributes: {
      queue_item_id: row.queue_item_id,
      action_type: row.action_type,
      destination_type: dest,
      destination_id: row.destination_id ?? null,
      status: normalizeStatus(row.status),
      webhook_delivery_id: row.webhook_delivery_id ?? null,
      export_job_id: row.export_job_id ?? null,
      error: row.error ?? null,
      meta: safeMeta(row.meta),
    },
  }
}

