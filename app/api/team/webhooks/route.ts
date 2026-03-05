import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createHash } from 'crypto'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { generateWebhookSecret } from '@/lib/integrations/webhooks'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  url: z.string().url().max(2000),
  events: z.array(z.string().min(1)).max(50).default([]),
})

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { data: endpoints, error } = await supabase
      .schema('api')
      .from('webhook_endpoints')
      .select(
        'id, workspace_id, url, events, is_enabled, created_by, created_at, last_success_at, last_error_at, failure_count, secret_last4, rotated_at'
      )
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return fail(ErrorCode.DATABASE_ERROR, 'Failed to load webhooks', undefined, undefined, bridge, requestId)

    return ok({ workspace, role: membership.role, endpoints: endpoints ?? [] }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/team/webhooks', userId, bridge, requestId)
  }
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = CreateSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const secret = generateWebhookSecret()
      const secretHash = sha256Hex(secret)
      const secretLast4 = secret.slice(-4)
      const rotatedAt = new Date().toISOString()

      const { data: endpoint, error } = await supabase
        .schema('api')
        .from('webhook_endpoints')
        .insert({
          workspace_id: workspace.id,
          url: parsed.data.url,
          events: parsed.data.events,
          is_enabled: true,
          created_by: user.id,
          secret_hash: secretHash,
          secret_last4: secretLast4,
          rotated_at: rotatedAt,
        })
        .select(
          'id, workspace_id, url, events, is_enabled, created_by, created_at, last_success_at, last_error_at, failure_count, secret_last4, rotated_at'
        )
        .single()

      if (error || !endpoint) return fail(ErrorCode.DATABASE_ERROR, 'Create failed', undefined, undefined, bridge, requestId)

      const admin = createSupabaseAdminClient({ schema: 'api' })
      await admin.from('webhook_endpoint_secrets').insert({
        endpoint_id: endpoint.id,
        secret,
        created_by: user.id,
      })

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'webhook.endpoint_created',
        targetType: 'webhook_endpoint',
        targetId: endpoint.id,
        meta: { url: parsed.data.url, events: parsed.data.events },
        request,
      })

      // Return secret ONLY once.
      return ok({ endpoint, secret }, { status: 201 }, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/team/webhooks', userId, bridge, requestId)
    }
  },
  { bodySchema: CreateSchema }
)

