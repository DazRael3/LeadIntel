import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { assistantEnabledFor } from '@/lib/assistant/permissions'
import type { AssistantScopeType } from '@/lib/assistant/types'
import { answerAssistantQuery } from '@/lib/assistant/engine'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  threadId: z.string().uuid().nullable().optional(),
  scope: z.object({
    type: z.enum(['workspace', 'account', 'command_center', 'executive', 'approvals', 'actions']),
    id: z.string().uuid().nullable().optional(),
  }),
  message: z.string().trim().min(1).max(2000),
})

function scopeToTarget(scope: { type: AssistantScopeType; id: string | null }): { targetType: string; targetId: string | null } {
  return { targetType: scope.type, targetId: scope.id }
}

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'assistant' })
      if (!gate.ok) {
        return fail(
          'ASSISTANT_PLAN_REQUIRED',
          'Upgrade required to use the Assistant.',
          { requiredPlan: 'team' },
          { status: 403 },
          bridge,
          requestId
        )
      }

      const parsed = BodySchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) {
        return fail(
          'ASSISTANT_WORKSPACE_REQUIRED',
          'Workspace setup required to use the Assistant.',
          { reason: 'workspace_missing' },
          { status: 422 },
          bridge,
          requestId
        )
      }

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) {
        return fail(
          'ASSISTANT_INSUFFICIENT_PERMISSIONS',
          'Insufficient permissions for this workspace.',
          { reason: 'workspace_membership_missing' },
          { status: 403 },
          bridge,
          requestId
        )
      }

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      const enabled = assistantEnabledFor({ policies, role: membership.role })
      if (!enabled.ok) {
        return fail('ASSISTANT_DISABLED', enabled.reason, { reason: 'assistant_disabled' }, { status: 403 }, bridge, requestId)
      }

      const scope = { type: parsed.data.scope.type, id: parsed.data.scope.id ?? null }

      let threadId = parsed.data.threadId ?? null
      if (!threadId) {
        if (!policies.assistant.assistantThreadsEnabled) {
          return fail(
            'ASSISTANT_THREADS_DISABLED',
            'Assistant threads are disabled for this workspace.',
            { reason: 'threads_disabled' },
            { status: 403 },
            bridge,
            requestId
          )
        }
        const t = scopeToTarget(scope)
        const { data: thread, error } = await supabase
          .schema('api')
          .from('assistant_threads')
          .insert({ workspace_id: ws.id, target_type: t.targetType, target_id: t.targetId, title: null, created_by: user.id })
          .select('id')
          .single()
        if (error || !thread) return fail(ErrorCode.DATABASE_ERROR, 'Thread create failed', undefined, undefined, bridge, requestId)
        threadId = (thread as { id: string }).id
      }

      // Store the user message (no analytics payload copies; stored only in DB thread).
      await supabase.schema('api').from('assistant_messages').insert({
        workspace_id: ws.id,
        thread_id: threadId,
        role: 'user',
        author_user_id: user.id,
        content_text: parsed.data.message,
        meta: { scope },
      })

      const answer = await answerAssistantQuery({
        supabase,
        userId: user.id,
        workspaceId: ws.id,
        scope,
        message: parsed.data.message,
      })

      await supabase.schema('api').from('assistant_messages').insert({
        workspace_id: ws.id,
        thread_id: threadId,
        role: 'assistant',
        author_user_id: user.id,
        content_text: answer.answer,
        meta: { sources: answer.sources, suggestedActions: answer.suggestedActions, groundingNote: answer.groundingNote, limitationsNote: answer.limitationsNote },
      })

      await supabase.schema('api').from('assistant_threads').update({ last_message_at: new Date().toISOString() }).eq('workspace_id', ws.id).eq('id', threadId)

      await logProductEvent({
        userId: user.id,
        eventName: 'assistant_prompt_submitted',
        eventProps: { workspaceId: ws.id, scope: scope.type },
      })

      return ok({ threadId, answer }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/assistant/chat', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

