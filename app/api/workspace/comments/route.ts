import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { createThread, listThreadsWithComments, reply, setThreadResolved } from '@/lib/services/comments'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const TargetSchema = z.object({
  target_type: z.enum(['action_queue_item', 'template']),
  target_id: z.string().uuid(),
})

const ListQuerySchema = TargetSchema

const CreateThreadSchema = TargetSchema.extend({
  thread_type: z.enum(['general', 'review_feedback', 'changes_requested', 'manager_note', 'handoff_note']).default('general'),
  body: z.string().min(1).max(4000),
})

const ReplySchema = z.object({
  thread_id: z.string().uuid(),
  body: z.string().min(1).max(4000),
  reply_to_id: z.string().uuid().nullable().optional(),
})

const ResolveSchema = z.object({
  thread_id: z.string().uuid(),
  resolved: z.boolean(),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId, query }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const parsed = ListQuerySchema.safeParse(query ?? {})
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { threads, commentsByThread } = await listThreadsWithComments({
      supabase,
      workspaceId: workspace.id,
      targetType: parsed.data.target_type,
      targetId: parsed.data.target_id,
    })

    await logProductEvent({
      userId: user.id,
      eventName: 'comment_thread_viewed',
      eventProps: { workspaceId: workspace.id, targetType: parsed.data.target_type, targetId: parsed.data.target_id, threadCount: threads.length },
    })

    return ok({ threads, commentsByThread }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/comments', userId, bridge, requestId)
  }
})

export const POST = withApiGuard(async (request: NextRequest, { requestId, userId, body }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const parsed = CreateThreadSchema.safeParse(body)
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { thread, comment } = await createThread({
      supabase,
      workspaceId: workspace.id,
      userId: user.id,
      targetType: parsed.data.target_type,
      targetId: parsed.data.target_id,
      threadType: parsed.data.thread_type,
      firstCommentBody: parsed.data.body,
    })

    await logAudit({
      supabase,
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: 'comment.thread_created',
      targetType: parsed.data.target_type,
      targetId: parsed.data.target_id,
      meta: { threadId: thread.id, threadType: thread.thread_type },
      request,
    })

    await logProductEvent({
      userId: user.id,
      eventName: 'comment_added',
      eventProps: { workspaceId: workspace.id, threadId: thread.id, targetType: parsed.data.target_type, targetId: parsed.data.target_id },
    })

    return ok({ thread, comment }, { status: 201 }, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/comments', userId, bridge, requestId)
  }
})

export const PATCH = withApiGuard(async (request: NextRequest, { requestId, userId, body }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    // PATCH is dual-mode:
    // - reply { thread_id, body, reply_to_id? }
    // - resolve { thread_id, resolved }
    const replyParsed = ReplySchema.safeParse(body)
    if (replyParsed.success) {
      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)
      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const comment = await reply({
        supabase,
        workspaceId: workspace.id,
        userId: user.id,
        threadId: replyParsed.data.thread_id,
        body: replyParsed.data.body,
        replyToId: replyParsed.data.reply_to_id ?? null,
      })

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'comment.added',
        targetType: 'comment_thread',
        targetId: replyParsed.data.thread_id,
        meta: { commentId: comment.id },
        request,
      })

      await logProductEvent({
        userId: user.id,
        eventName: 'comment_added',
        eventProps: { workspaceId: workspace.id, threadId: replyParsed.data.thread_id, commentId: comment.id },
      })

      return ok({ comment }, undefined, bridge, requestId)
    }

    const resolveParsed = ResolveSchema.safeParse(body)
    if (resolveParsed.success) {
      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)
      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const thread = await setThreadResolved({
        supabase,
        workspaceId: workspace.id,
        userId: user.id,
        threadId: resolveParsed.data.thread_id,
        resolved: resolveParsed.data.resolved,
      })

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: resolveParsed.data.resolved ? 'comment.thread_resolved' : 'comment.thread_reopened',
        targetType: 'comment_thread',
        targetId: resolveParsed.data.thread_id,
        meta: {},
        request,
      })

      await logProductEvent({
        userId: user.id,
        eventName: 'thread_resolved',
        eventProps: { workspaceId: workspace.id, threadId: resolveParsed.data.thread_id, resolved: resolveParsed.data.resolved },
      })

      return ok({ thread }, undefined, bridge, requestId)
    }

    return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', undefined, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/comments', userId, bridge, requestId)
  }
})

