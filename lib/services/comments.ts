import type { SupabaseClient } from '@supabase/supabase-js'
import type { Comment, CommentThread, CommentThreadStatus, CommentThreadType, CommentTargetType } from '@/lib/domain/comments'

type DbThread = {
  id: string
  workspace_id: string
  target_type: string
  target_id: string
  thread_type: string
  status: string
  created_by: string
  created_at: string
  resolved_by: string | null
  resolved_at: string | null
}

type DbComment = {
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

function isThreadType(x: string): x is CommentThreadType {
  return x === 'general' || x === 'review_feedback' || x === 'changes_requested' || x === 'manager_note' || x === 'handoff_note'
}
function isThreadStatus(x: string): x is CommentThreadStatus {
  return x === 'open' || x === 'resolved'
}
function isTargetType(x: string): x is CommentTargetType {
  return x === 'action_queue_item' || x === 'template'
}

function normalizeThread(t: DbThread): CommentThread {
  return {
    id: t.id,
    workspace_id: t.workspace_id,
    target_type: isTargetType(t.target_type) ? t.target_type : 'action_queue_item',
    target_id: t.target_id,
    thread_type: isThreadType(t.thread_type) ? t.thread_type : 'general',
    status: isThreadStatus(t.status) ? t.status : 'open',
    created_by: t.created_by,
    created_at: t.created_at,
    resolved_by: t.resolved_by,
    resolved_at: t.resolved_at,
  }
}

function normalizeComment(c: DbComment): Comment {
  return {
    id: c.id,
    workspace_id: c.workspace_id,
    thread_id: c.thread_id,
    author_user_id: c.author_user_id,
    body_text: c.body_text,
    reply_to_id: c.reply_to_id,
    created_at: c.created_at,
    edited_at: c.edited_at,
    deleted_at: c.deleted_at,
  }
}

export async function listThreadsWithComments(args: {
  supabase: SupabaseClient
  workspaceId: string
  targetType: CommentTargetType
  targetId: string
}): Promise<{ threads: CommentThread[]; commentsByThread: Record<string, Comment[]> }> {
  const { data: threads } = await args.supabase
    .schema('api')
    .from('comment_threads')
    .select('*')
    .eq('workspace_id', args.workspaceId)
    .eq('target_type', args.targetType)
    .eq('target_id', args.targetId)
    .order('created_at', { ascending: true })
    .limit(50)

  const normalizedThreads = (threads ?? []).map((t) => normalizeThread(t as unknown as DbThread))
  const threadIds = normalizedThreads.map((t) => t.id)
  if (threadIds.length === 0) return { threads: [], commentsByThread: {} }

  const { data: comments } = await args.supabase
    .schema('api')
    .from('comments')
    .select('*')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: true })
    .limit(500)

  const map: Record<string, Comment[]> = {}
  for (const c of (comments ?? []).map((x) => normalizeComment(x as unknown as DbComment))) {
    map[c.thread_id] = map[c.thread_id] ?? []
    map[c.thread_id]?.push(c)
  }
  return { threads: normalizedThreads, commentsByThread: map }
}

export async function createThread(args: {
  supabase: SupabaseClient
  workspaceId: string
  userId: string
  targetType: CommentTargetType
  targetId: string
  threadType: CommentThreadType
  firstCommentBody: string
}): Promise<{ thread: CommentThread; comment: Comment }> {
  const body = args.firstCommentBody.trim()
  if (body.length === 0) throw new Error('empty_comment')
  if (body.length > 4000) throw new Error('comment_too_long')

  const { data: thread, error: threadError } = await args.supabase
    .schema('api')
    .from('comment_threads')
    .insert({
      workspace_id: args.workspaceId,
      target_type: args.targetType,
      target_id: args.targetId,
      thread_type: args.threadType,
      status: 'open',
      created_by: args.userId,
    })
    .select('*')
    .single()
  if (threadError || !thread) throw new Error('failed_to_create_thread')

  const { data: comment, error: commentError } = await args.supabase
    .schema('api')
    .from('comments')
    .insert({
      workspace_id: args.workspaceId,
      thread_id: (thread as { id: string }).id,
      author_user_id: args.userId,
      body_text: body,
      reply_to_id: null,
    })
    .select('*')
    .single()
  if (commentError || !comment) throw new Error('failed_to_create_comment')

  return { thread: normalizeThread(thread as unknown as DbThread), comment: normalizeComment(comment as unknown as DbComment) }
}

export async function reply(args: {
  supabase: SupabaseClient
  workspaceId: string
  userId: string
  threadId: string
  body: string
  replyToId?: string | null
}): Promise<Comment> {
  const body = args.body.trim()
  if (body.length === 0) throw new Error('empty_comment')
  if (body.length > 4000) throw new Error('comment_too_long')

  const { data: comment, error } = await args.supabase
    .schema('api')
    .from('comments')
    .insert({
      workspace_id: args.workspaceId,
      thread_id: args.threadId,
      author_user_id: args.userId,
      body_text: body,
      reply_to_id: args.replyToId ?? null,
    })
    .select('*')
    .single()
  if (error || !comment) throw new Error('failed_to_reply')
  return normalizeComment(comment as unknown as DbComment)
}

export async function setThreadResolved(args: {
  supabase: SupabaseClient
  workspaceId: string
  userId: string
  threadId: string
  resolved: boolean
}): Promise<CommentThread> {
  const patch = args.resolved
    ? { status: 'resolved', resolved_by: args.userId, resolved_at: new Date().toISOString() }
    : { status: 'open', resolved_by: null, resolved_at: null }

  const { data: thread, error } = await args.supabase
    .schema('api')
    .from('comment_threads')
    .update(patch)
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.threadId)
    .select('*')
    .single()
  if (error || !thread) throw new Error('failed_to_update_thread')
  return normalizeThread(thread as unknown as DbThread)
}

