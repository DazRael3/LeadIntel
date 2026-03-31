import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  default_handoff_webhook_endpoint_id: z.string().uuid().nullable(),
})

export const POST = withApiGuard(async (request: NextRequest, { requestId, userId, body }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({
      userId: user.id,
      sessionEmail: user.email ?? null,
      supabase,
      capability: 'integration_destination_health',
    })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    const endpointId = parsed.data.default_handoff_webhook_endpoint_id
    if (endpointId) {
      const { data: endpoint } = await supabase
        .schema('api')
        .from('webhook_endpoints')
        .select('id, workspace_id, is_enabled')
        .eq('id', endpointId)
        .eq('workspace_id', workspace.id)
        .maybeSingle()

      const isEnabled = (endpoint as { is_enabled?: unknown } | null)?.is_enabled
      if (!endpoint) return fail(ErrorCode.NOT_FOUND, 'Not found', undefined, { status: 404 }, bridge, requestId)
      if (isEnabled !== true) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'Endpoint must be enabled',
          { endpointId: 'Webhook endpoint is disabled' },
          undefined,
          bridge,
          requestId
        )
      }
    }

    const { error } = await supabase
      .schema('api')
      .from('workspaces')
      .update({ default_handoff_webhook_endpoint_id: endpointId })
      .eq('id', workspace.id)
    if (error) return fail(ErrorCode.INTERNAL_ERROR, 'Failed to save', undefined, undefined, bridge, requestId)

    await logAudit({
      supabase,
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: 'workspace.integrations.defaults_updated',
      targetType: 'workspace',
      targetId: workspace.id,
      meta: { default_handoff_webhook_endpoint_id: endpointId },
      request,
    })

    return ok({ saved: true }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/integrations/defaults', userId, bridge, requestId)
  }
})

