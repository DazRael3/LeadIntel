import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(240),
})

const SetDefaultSchema = z.object({
  setId: z.string().uuid().nullable(),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'approvals' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) {
      return ok({ configured: false, reason: 'workspace_missing', workspace: { id: '', default_template_set_id: null }, role: 'viewer', sets: [] }, undefined, bridge, requestId)
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { data: sets, error } = await supabase
      .schema('api')
      .from('template_sets')
      .select('id, workspace_id, name, description, created_by, created_at')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true })

    if (error) return fail(ErrorCode.DATABASE_ERROR, 'Failed to load template sets', undefined, undefined, bridge, requestId)

    return ok({ workspace, role: membership.role, sets: sets ?? [] }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/team/template-sets', userId, bridge, requestId)
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

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'approvals' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = CreateSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'Workspace required',
          { workspace: 'Create or select a workspace before managing template sets.' },
          { status: 422 },
          bridge,
          requestId
        )
      }

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const { data: setRow, error } = await supabase
        .schema('api')
        .from('template_sets')
        .insert({
          workspace_id: workspace.id,
          name: parsed.data.name,
          description: parsed.data.description,
          created_by: user.id,
        })
        .select('id, workspace_id, name, description, created_by, created_at')
        .single()

      if (error || !setRow) return fail(ErrorCode.DATABASE_ERROR, 'Create failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'template_set.created',
        targetType: 'template_set',
        targetId: setRow.id,
        meta: { name: parsed.data.name },
        request,
      })

      return ok({ set: setRow }, { status: 201 }, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/team/template-sets', userId, bridge, requestId)
    }
  },
  { bodySchema: CreateSchema }
)

export const PATCH = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'approvals' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = SetDefaultSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'Workspace required',
          { workspace: 'Create or select a workspace before managing template sets.' },
          { status: 422 },
          bridge,
          requestId
        )
      }

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const { error } = await supabase
        .schema('api')
        .from('workspaces')
        .update({ default_template_set_id: parsed.data.setId })
        .eq('id', workspace.id)

      if (error) return fail(ErrorCode.DATABASE_ERROR, 'Save failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'template_set.default_changed',
        targetType: 'workspace',
        targetId: workspace.id,
        meta: { defaultSetId: parsed.data.setId },
        request,
      })

      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/team/template-sets', userId, bridge, requestId)
    }
  },
  { bodySchema: SetDefaultSchema }
)

