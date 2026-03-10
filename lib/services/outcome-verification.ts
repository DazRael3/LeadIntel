import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export type VerificationTargetType = 'crm_mapping' | 'opportunity_observation' | 'workflow_outcome_link'
export type VerificationStatus = 'verified' | 'ambiguous' | 'not_linked' | 'needs_review_later'

export type VerificationReviewRow = {
  id: string
  workspace_id: string
  target_type: VerificationTargetType
  target_id: string
  status: VerificationStatus
  note: string | null
  reviewed_by: string
  reviewed_at: string
  created_at: string
}

export const CreateVerificationReviewSchema = z.object({
  targetType: z.enum(['crm_mapping', 'opportunity_observation', 'workflow_outcome_link']),
  targetId: z.string().uuid(),
  status: z.enum(['verified', 'ambiguous', 'not_linked', 'needs_review_later']),
  note: z.string().trim().min(1).max(2000).nullable().optional(),
})

type DbRow = {
  id: string
  workspace_id: string
  target_type: string
  target_id: string
  status: string
  note: string | null
  reviewed_by: string
  reviewed_at: string
  created_at: string
}

function isTargetType(x: string): x is VerificationTargetType {
  return x === 'crm_mapping' || x === 'opportunity_observation' || x === 'workflow_outcome_link'
}
function isStatus(x: string): x is VerificationStatus {
  return x === 'verified' || x === 'ambiguous' || x === 'not_linked' || x === 'needs_review_later'
}

function normalize(r: DbRow): VerificationReviewRow {
  return {
    id: r.id,
    workspace_id: r.workspace_id,
    target_type: isTargetType(r.target_type) ? r.target_type : 'crm_mapping',
    target_id: r.target_id,
    status: isStatus(r.status) ? r.status : 'needs_review_later',
    note: r.note ?? null,
    reviewed_by: r.reviewed_by,
    reviewed_at: r.reviewed_at,
    created_at: r.created_at,
  }
}

export async function createVerificationReview(args: {
  supabase: SupabaseClient
  workspaceId: string
  actorUserId: string
  input: z.infer<typeof CreateVerificationReviewSchema>
}): Promise<VerificationReviewRow> {
  const parsed = CreateVerificationReviewSchema.parse(args.input)
  const { data, error } = await args.supabase
    .schema('api')
    .from('revenue_verification_reviews')
    .insert({
      workspace_id: args.workspaceId,
      target_type: parsed.targetType,
      target_id: parsed.targetId,
      status: parsed.status,
      note: parsed.note ?? null,
      reviewed_by: args.actorUserId,
      reviewed_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error || !data) throw new Error('verification_review_create_failed')
  return normalize(data as unknown as DbRow)
}

export async function listVerificationReviews(args: {
  supabase: SupabaseClient
  workspaceId: string
  limit: number
}): Promise<VerificationReviewRow[]> {
  const { data, error } = await args.supabase
    .schema('api')
    .from('revenue_verification_reviews')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .order('reviewed_at', { ascending: false })
    .limit(args.limit)
  if (error) throw new Error('verification_review_list_failed')
  return (data ?? []).map((r) => normalize(r as unknown as DbRow))
}

