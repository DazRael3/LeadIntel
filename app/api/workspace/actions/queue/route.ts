import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { listActionQueueItems } from '@/lib/services/action-queue'
import type { ActionQueueStatus } from '@/lib/domain/action-queue'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  status: z
    .enum(['ready', 'queued', 'processing', 'delivered', 'failed', 'blocked', 'manual_review', 'all'])
    .optional()
    .default('all'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'integration_delivery_audit' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) {
      // Production safety: don't 500 just because workspace bootstrap isn't ready.
      return ok({ items: [] }, undefined, bridge, requestId)
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const items = await listActionQueueItems({
      supabase,
      workspaceId: workspace.id,
      status: parsed.data.status === 'all' ? 'all' : (parsed.data.status as ActionQueueStatus),
      limit: parsed.data.limit,
    })

    await logProductEvent({
      userId: user.id,
      eventName: 'action_queue_viewed',
      eventProps: { workspaceId: workspace.id, status: parsed.data.status, limit: parsed.data.limit },
    })

    return ok({ items }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/actions/queue', userId, bridge, requestId)
  }
})

