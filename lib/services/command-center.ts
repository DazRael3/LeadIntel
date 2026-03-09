import type { SupabaseClient } from '@supabase/supabase-js'

export type CommandLaneKey = 'act_now' | 'review_needed' | 'blocked' | 'waiting' | 'stale'

export type CommandLaneItem = {
  id: string
  lane: CommandLaneKey
  title: string
  subtitle: string
  kind: 'queue_item' | 'approval'
  createdAt: string
  targetId: string
}

export type CommandCenterSummary = {
  workspaceId: string
  computedAt: string
  lanes: Record<CommandLaneKey, CommandLaneItem[]>
  limitationsNote: string
}

type QueueRow = {
  id: string
  lead_id: string | null
  action_type: string
  status: string
  reason: string | null
  created_at: string
  payload_meta: unknown
}

type ApprovalRow = {
  id: string
  target_type: string
  target_id: string
  status: string
  note: string | null
  updated_at: string
}

function metaStr(meta: unknown, key: string): string | null {
  if (!meta || typeof meta !== 'object') return null
  const v = (meta as Record<string, unknown>)[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export async function buildCommandCenter(args: { supabase: SupabaseClient; workspaceId: string; limit: number }): Promise<CommandCenterSummary> {
  const computedAt = new Date().toISOString()
  const [queueRes, approvalsRes] = await Promise.all([
    args.supabase
      .schema('api')
      .from('action_queue_items')
      .select('id, lead_id, action_type, status, reason, created_at, payload_meta')
      .eq('workspace_id', args.workspaceId)
      .order('created_at', { ascending: false })
      .limit(Math.min(200, args.limit)),
    args.supabase
      .schema('api')
      .from('approval_requests')
      .select('id, target_type, target_id, status, note, updated_at')
      .eq('workspace_id', args.workspaceId)
      .in('status', ['pending_review', 'changes_requested'])
      .order('updated_at', { ascending: false })
      .limit(50),
  ])

  const queue = (queueRes.data ?? []) as unknown as QueueRow[]
  const approvals = (approvalsRes.data ?? []) as unknown as ApprovalRow[]

  const lanes: Record<CommandLaneKey, CommandLaneItem[]> = {
    act_now: [],
    review_needed: [],
    blocked: [],
    waiting: [],
    stale: [],
  }

  for (const a of approvals) {
    const lane: CommandLaneKey = a.status === 'pending_review' ? 'review_needed' : 'waiting'
    lanes[lane].push({
      id: a.id,
      lane,
      title: 'Approval',
      subtitle: a.note ?? `${a.target_type} review`,
      kind: 'approval',
      createdAt: a.updated_at,
      targetId: a.target_id,
    })
  }

  for (const q of queue) {
    const company = metaStr(q.payload_meta, 'companyName') ?? metaStr(q.payload_meta, 'companyDomain') ?? (q.lead_id ? `Account ${q.lead_id.slice(0, 8)}…` : q.id.slice(0, 8) + '…')
    const subtitle = q.reason ?? q.action_type
    if (q.status === 'ready') {
      lanes.act_now.push({ id: q.id, lane: 'act_now', title: company, subtitle, kind: 'queue_item', createdAt: q.created_at, targetId: q.id })
    } else if (q.status === 'manual_review') {
      lanes.review_needed.push({ id: q.id, lane: 'review_needed', title: company, subtitle: 'Manual review needed', kind: 'queue_item', createdAt: q.created_at, targetId: q.id })
    } else if (q.status === 'failed' || q.status === 'blocked') {
      lanes.blocked.push({ id: q.id, lane: 'blocked', title: company, subtitle, kind: 'queue_item', createdAt: q.created_at, targetId: q.id })
    } else if (q.status === 'queued' || q.status === 'processing') {
      lanes.waiting.push({ id: q.id, lane: 'waiting', title: company, subtitle: 'Processing', kind: 'queue_item', createdAt: q.created_at, targetId: q.id })
    } else {
      lanes.stale.push({ id: q.id, lane: 'stale', title: company, subtitle, kind: 'queue_item', createdAt: q.created_at, targetId: q.id })
    }
  }

  for (const k of Object.keys(lanes) as CommandLaneKey[]) {
    lanes[k] = lanes[k].slice(0, 12)
  }

  return {
    workspaceId: args.workspaceId,
    computedAt,
    lanes,
    limitationsNote: 'Command Center is a focused operating view derived from queue + approvals. It is not real-time and does not expose protected content.',
  }
}

