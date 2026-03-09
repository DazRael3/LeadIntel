import type { PlatformObject } from '@/lib/platform-api/objects'

export type ActionQueueRow = {
  id: string
  workspace_id: string
  lead_id: string | null
  action_type: string
  status: string
  destination_type: string | null
  destination_id: string | null
  reason: string | null
  error: string | null
  created_at: string
  updated_at: string
  payload_meta: unknown
}

type QueueStatus = 'ready' | 'queued' | 'processing' | 'delivered' | 'failed' | 'blocked' | 'manual_review'

function normalizeStatus(x: string): QueueStatus {
  const v = (x ?? '').toLowerCase()
  if (v === 'queued' || v === 'processing' || v === 'delivered' || v === 'failed' || v === 'blocked' || v === 'manual_review') return v
  return 'ready'
}

function safeMeta(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== 'object') return {}
  const m = meta as Record<string, unknown>
  // Never return potentially sensitive generated bodies; meta is intended to be operational.
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(m)) {
    if (k.toLowerCase().includes('body') || k.toLowerCase().includes('markdown') || k.toLowerCase().includes('content')) continue
    out[k] = m[k]
  }
  return out
}

export function serializeActionQueueItem(row: ActionQueueRow): PlatformObject<
  'action_queue_item',
  {
    lead_id: string | null
    action_type: string
    status: QueueStatus
    destination_type: string | null
    destination_id: string | null
    reason: string | null
    error: string | null
    payload_meta: Record<string, unknown>
  }
> {
  return {
    id: row.id,
    object: 'action_queue_item',
    workspace_id: row.workspace_id,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    attributes: {
      lead_id: row.lead_id,
      action_type: row.action_type,
      status: normalizeStatus(row.status),
      destination_type: row.destination_type ?? null,
      destination_id: row.destination_id ?? null,
      reason: row.reason ?? null,
      error: row.error ?? null,
      payload_meta: safeMeta(row.payload_meta),
    },
  }
}

