import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createHash } from 'crypto'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { generateWebhookSecret } from '@/lib/integrations/webhooks'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  is_enabled: z.boolean().optional(),
  events: z.array(z.string().min(1)).max(50).optional(),
})

const RotateSchema = z.object({
  rotate: z.literal(true),
})

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export const PATCH = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
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

      const url = new URL(request.url)
      const endpointId = url.pathname.split('/').pop() || ''
      if (!endpointId) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', { endpointId: 'Missing endpoint id' }, undefined, bridge, requestId)

      // Rotate flow: { rotate: true }
      const rotate = RotateSchema.safeParse(body)
      if (rotate.success) {
        await ensurePersonalWorkspace({ supabase, userId: user.id })
        const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
        if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

        const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
          return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
        }

        const secret = generateWebhookSecret()
        const secretHash = sha256Hex(secret)
        const secretLast4 = secret.slice(-4)
        const rotatedAt = new Date().toISOString()

        const { error: updateError } = await supabase
          .schema('api')
          .from('webhook_endpoints')
          .update({ secret_hash: secretHash, secret_last4: secretLast4, rotated_at: rotatedAt })
          .eq('id', endpointId)
          .eq('workspace_id', workspace.id)

        if (updateError) return fail(ErrorCode.DATABASE_ERROR, 'Rotate failed', undefined, undefined, bridge, requestId)

        const admin = createSupabaseAdminClient({ schema: 'api' })
        // Revoke previous secrets (best-effort) then insert new one.
        await admin.from('webhook_endpoint_secrets').update({ revoked_at: new Date().toISOString() }).eq('endpoint_id', endpointId).is('revoked_at', null)
        await admin.from('webhook_endpoint_secrets').insert({ endpoint_id: endpointId, secret, created_by: user.id })

        await logAudit({
          supabase,
          workspaceId: workspace.id,
          actorUserId: user.id,
          action: 'webhook.secret_rotated',
          targetType: 'webhook_endpoint',
          targetId: endpointId,
          meta: {},
          request,
        })

        return ok({ secret }, undefined, bridge, requestId)
      }

      const parsed = PatchSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const update: Record<string, unknown> = {}
      if (typeof parsed.data.is_enabled === 'boolean') update.is_enabled = parsed.data.is_enabled
      if (Array.isArray(parsed.data.events)) update.events = parsed.data.events

      const { data: endpoint, error } = await supabase
        .schema('api')
        .from('webhook_endpoints')
        .update(update)
        .eq('id', endpointId)
        .eq('workspace_id', workspace.id)
        .select(
          'id, workspace_id, url, events, is_enabled, created_by, created_at, last_success_at, last_error_at, failure_count, secret_last4, rotated_at'
        )
        .single()

      if (error || !endpoint) return fail(ErrorCode.DATABASE_ERROR, 'Save failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'webhook.endpoint_updated',
        targetType: 'webhook_endpoint',
        targetId: endpoint.id,
        meta: { fields: Object.keys(update) },
        request,
      })

      return ok({ endpoint }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/team/webhooks/[endpointId]', userId, bridge, requestId)
    }
  },
  { bodySchema: z.any() }
)

