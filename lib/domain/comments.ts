export type CommentThreadType = 'general' | 'review_feedback' | 'changes_requested' | 'manager_note' | 'handoff_note'
export type CommentThreadStatus = 'open' | 'resolved'

export type CommentTargetType = 'action_queue_item' | 'template'

export type CommentThread = {
  id: string
  workspace_id: string
  target_type: CommentTargetType
  target_id: string
  thread_type: CommentThreadType
  status: CommentThreadStatus
  created_by: string
  created_at: string
  resolved_by: string | null
  resolved_at: string | null
}

export type Comment = {
  id: string
  workspace_id: string
  thread_id: string
  author_user_id: string
  body_text: string
  reply_to_id: string | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

