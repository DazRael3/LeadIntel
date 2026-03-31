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
import { suggestedPromptsForScope } from '@/lib/assistant/suggested-prompts'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  scope: z.enum(['workspace', 'account', 'command_center', 'executive', 'approvals', 'actions']).default('workspace'),
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

      const prompts = suggestedPromptsForScope(parsed.data.scope)
      return ok({ scope: parsed.data.scope, prompts }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/assistant/suggested-prompts', userId, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

