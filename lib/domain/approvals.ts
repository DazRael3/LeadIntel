import { z } from 'zod'

export type ApprovalStatus = 'draft' | 'pending_review' | 'changes_requested' | 'approved' | 'archived'
export type ApprovalTargetType = 'template'

export type ApprovalRequest = {
  id: string
  workspace_id: string
  target_type: ApprovalTargetType
  target_id: string
  status: ApprovalStatus
  submitted_by: string | null
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  note: string | null
  meta: Record<string, unknown>
  created_at: string
  updated_at: string
}

export const ApprovalStatusSchema = z.enum(['draft', 'pending_review', 'changes_requested', 'approved', 'archived'])
export const ApprovalTargetTypeSchema = z.enum(['template'])

export const CreateApprovalSchema = z.object({
  targetType: ApprovalTargetTypeSchema,
  targetId: z.string().uuid(),
  note: z.string().trim().max(500).nullable().optional(),
})

export const UpdateApprovalSchema = z.object({
  id: z.string().uuid(),
  status: ApprovalStatusSchema,
  note: z.string().trim().max(500).nullable().optional(),
})

