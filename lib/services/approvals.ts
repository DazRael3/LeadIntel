import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApprovalRequest, ApprovalStatus, ApprovalTargetType } from '@/lib/domain/approvals'

type DbRow = {
  id: string
  workspace_id: string
  target_type: string
  target_id: string
  status: string
  submitted_by: string | null
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  note: string | null
  meta: unknown
  created_at: string
  updated_at: string
}

function isStatus(x: string): x is ApprovalStatus {
  return x === 'draft' || x === 'pending_review' || x === 'changes_requested' || x === 'approved' || x === 'archived'
}

function isTarget(x: string): x is ApprovalTargetType {
  return x === 'template'
}

function normalize(r: DbRow): ApprovalRequest {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    target_type: isTarget(r.target_type) ? r.target_type : 'template',
    target_id: r.target_id,
    status: isStatus(r.status) ? r.status : 'draft',
    submitted_by: r.submitted_by,
    submitted_at: r.submitted_at,
    reviewed_by: r.reviewed_by,
    reviewed_at: r.reviewed_at,
    note: r.note,
    meta: r.meta && typeof r.meta === 'object' ? (r.meta as Record<string, unknown>) : {},
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

export async function listApprovalRequests(args: {
  supabase: SupabaseClient
  workspaceId: string
  status?: ApprovalStatus | 'all'
  limit: number
}): Promise<ApprovalRequest[]> {
  let q = args.supabase
    .schema('api')
    .from('approval_requests')
    .select('id, workspace_id, target_type, target_id, status, submitted_by, submitted_at, reviewed_by, reviewed_at, note, meta, created_at, updated_at')
    .eq('workspace_id', args.workspaceId)
    .order('updated_at', { ascending: false })
    .limit(args.limit)

  if (args.status && args.status !== 'all') q = q.eq('status', args.status)

  const { data } = await q
  return ((data ?? []) as unknown as DbRow[]).map((r) => normalize(r))
}

export async function submitApprovalRequest(args: {
  supabase: SupabaseClient
  workspaceId: string
  actorUserId: string
  targetType: ApprovalTargetType
  targetId: string
  note: string | null
}): Promise<ApprovalRequest> {
  const now = new Date().toISOString()
  const { data, error } = await args.supabase
    .schema('api')
    .from('approval_requests')
    .upsert(
      {
        workspace_id: args.workspaceId,
        target_type: args.targetType,
        target_id: args.targetId,
        status: 'pending_review',
        submitted_by: args.actorUserId,
        submitted_at: now,
        reviewer_user_id: null,
        note: args.note ?? null,
        meta: {},
      },
      { onConflict: 'workspace_id,target_type,target_id' }
    )
    .select('id, workspace_id, target_type, target_id, status, submitted_by, submitted_at, reviewed_by, reviewed_at, note, meta, created_at, updated_at')
    .single()

  if (error || !data) throw new Error('approval_submit_failed')
  return normalize(data as unknown as DbRow)
}

export async function setApprovalStatus(args: {
  supabase: SupabaseClient
  workspaceId: string
  actorUserId: string
  approvalId: string
  status: ApprovalStatus
  note: string | null
}): Promise<ApprovalRequest> {
  const patch: Record<string, unknown> = {
    status: args.status,
    note: args.note ?? null,
    reviewed_by: args.actorUserId,
    reviewed_at: new Date().toISOString(),
  }
  const { data, error } = await args.supabase
    .schema('api')
    .from('approval_requests')
    .update(patch)
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.approvalId)
    .select('id, workspace_id, target_type, target_id, status, submitted_by, submitted_at, reviewed_by, reviewed_at, note, meta, created_at, updated_at')
    .single()
  if (error || !data) throw new Error('approval_update_failed')
  return normalize(data as unknown as DbRow)
}

