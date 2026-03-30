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

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  targetType: z.enum(['workspace', 'account', 'command_center', 'executive', 'approvals', 'actions']).optional(),
  targetId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(5).max(50).optional().default(20),
})

const CreateSchema = z.object({
  targetType: z.enum(['workspace', 'account', 'command_center', 'executive', 'approvals', 'actions']),
  targetId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(120).nullable().optional(),
})

export const GET = withApiGuard(
  async (request: NextRequest, { requestId, userId, query }) => {
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

      const parsed = QuerySchema.safeParse(query ?? {})
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

      let q = supabase
        .schema('api')
        .from('assistant_threads')
        .select('id, workspace_id, target_type, target_id, title, created_by, created_at, updated_at, last_message_at')
        .eq('workspace_id', ws.id)
        .order('updated_at', { ascending: false })
        .limit(parsed.data.limit)

      if (parsed.data.targetType) q = q.eq('target_type', parsed.data.targetType)
      if (parsed.data.targetId) q = q.eq('target_id', parsed.data.targetId)

      const { data: threads } = await q
      return ok({ workspace: { id: ws.id, name: ws.name }, role: membership.role, threads: threads ?? [] }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/assistant/threads', userId, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

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

      const parsed = CreateSchema.safeParse(body ?? {})
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

      const { data: thread, error } = await supabase
        .schema('api')
        .from('assistant_threads')
        .insert({
          workspace_id: ws.id,
          target_type: parsed.data.targetType,
          target_id: parsed.data.targetId ?? null,
          title: parsed.data.title ?? null,
          created_by: user.id,
          last_message_at: null,
        })
        .select('id, workspace_id, target_type, target_id, title, created_by, created_at, updated_at, last_message_at')
        .single()
      if (error || !thread) return fail(ErrorCode.DATABASE_ERROR, 'Create failed', undefined, undefined, bridge, requestId)

      return ok({ thread }, { status: 201 }, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/assistant/threads', userId, bridge, requestId)
    }
  },
  { bodySchema: CreateSchema }
)

