import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  clientLabel: z.string().trim().max(160).nullable().optional(),
  referenceTags: z.array(z.string().trim().min(1).max(40)).max(25).optional(),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'workspace_controls' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)
    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { data } = await supabase
      .schema('api')
      .from('workspaces')
      .select('id, name, client_label, reference_tags')
      .eq('id', ws.id)
      .maybeSingle()

    await logProductEvent({ userId: user.id, eventName: 'workspace_controls_viewed', eventProps: { workspaceId: ws.id, surface: 'branding' } })

    return ok({ workspace: data ?? null, role: membership.role }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/branding', userId, bridge, requestId)
  }
})

export const PATCH = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'workspace_controls' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = PatchSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)
      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const patch: Record<string, unknown> = {}
      if (typeof parsed.data.name === 'string') patch.name = parsed.data.name
      if (parsed.data.clientLabel !== undefined) patch.client_label = parsed.data.clientLabel
      if (parsed.data.referenceTags) patch.reference_tags = Array.from(new Set(parsed.data.referenceTags.map((t) => t.toLowerCase()))).slice(0, 25)

      const { data, error } = await supabase.schema('api').from('workspaces').update(patch).eq('id', ws.id).select('id, name, client_label, reference_tags').single()
      if (error) return fail(ErrorCode.DATABASE_ERROR, 'Update failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'workspace.branding_updated',
        targetType: 'workspace',
        targetId: ws.id,
        meta: { keys: Object.keys(patch) },
        request,
      })
      await logProductEvent({ userId: user.id, eventName: 'workspace_controls_viewed', eventProps: { workspaceId: ws.id, action: 'branding_updated' } })

      return ok({ workspace: data }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/workspace/branding', userId, bridge, requestId)
    }
  },
  { bodySchema: PatchSchema }
)

