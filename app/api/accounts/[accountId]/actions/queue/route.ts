import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { createActionQueueItem } from '@/lib/services/action-queue'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  reason: z.string().min(1).max(200).optional(),
})

function extractAccountIdFromPath(pathname: string): string | null {
  // /api/accounts/[accountId]/actions/queue
  const parts = pathname.split('/').filter(Boolean)
  const accountId = parts.at(-3)
  return typeof accountId === 'string' && accountId.trim().length > 0 ? accountId : null
}

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      const accountId = extractAccountIdFromPath(new URL(request.url).pathname)
      if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'action_queue' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      // Defense-in-depth: ensure the target account belongs to this user.
      // Leads are user-scoped (not workspace-scoped) in this app's schema.
      const { data: lead } = await supabase.schema('api').from('leads').select('id').eq('id', accountId).eq('user_id', user.id).maybeSingle()
      if (!lead) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)

      const item = await createActionQueueItem({
        supabase,
        workspaceId: workspace.id,
        userId: user.id,
        leadId: accountId,
        actionType: 'manual_review_required',
        status: 'manual_review',
        destinationType: null,
        destinationId: null,
        reason: parsed.data.reason ?? 'Added from account action center',
        payloadMeta: {},
      })

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'action_queue.item_created',
        targetType: 'lead',
        targetId: accountId,
        meta: { queueItemId: item.id },
        request,
      })

      return ok({ queueItemId: item.id }, { status: 201 }, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/accounts/[accountId]/actions/queue', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

