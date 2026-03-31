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

const RuleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  territoryKey: z.string().trim().min(1).max(80),
  priority: z.coerce.number().int().min(1).max(10000).optional().default(100),
  matchType: z.enum(['domain_suffix', 'domain_exact', 'tag']),
  matchValue: z.string().trim().min(1).max(200),
  isEnabled: z.boolean().optional().default(true),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'territory_controls' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { data } = await supabase
      .schema('api')
      .from('territory_rules')
      .select('id, name, territory_key, priority, match_type, match_value, is_enabled, updated_at')
      .eq('workspace_id', ws.id)
      .order('priority', { ascending: true })
      .limit(200)

    await logProductEvent({ userId: user.id, eventName: 'territory_page_viewed', eventProps: { workspaceId: ws.id } })
    return ok({ rules: data ?? [] }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/territories', userId, bridge, requestId)
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

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'territory_controls' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = RuleSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const { data, error } = await supabase
        .schema('api')
        .from('territory_rules')
        .insert({
          workspace_id: ws.id,
          name: parsed.data.name,
          territory_key: parsed.data.territoryKey,
          priority: parsed.data.priority,
          match_type: parsed.data.matchType,
          match_value: parsed.data.matchValue,
          is_enabled: parsed.data.isEnabled,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (error || !data) return fail(ErrorCode.DATABASE_ERROR, 'Save failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'territory.rule_created',
        targetType: 'territory_rule',
        targetId: null,
        meta: { ruleId: data.id, matchType: parsed.data.matchType },
        request,
      })

      return ok({ id: data.id }, { status: 201 }, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/workspace/territories', userId, bridge, requestId)
    }
  },
  { bodySchema: RuleSchema }
)

const PatchSchema = RuleSchema.extend({ id: z.string().uuid() })

export const PATCH = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'territory_controls' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = PatchSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const { error } = await supabase
        .schema('api')
        .from('territory_rules')
        .update({
          name: parsed.data.name,
          territory_key: parsed.data.territoryKey,
          priority: parsed.data.priority,
          match_type: parsed.data.matchType,
          match_value: parsed.data.matchValue,
          is_enabled: parsed.data.isEnabled,
        })
        .eq('workspace_id', ws.id)
        .eq('id', parsed.data.id)

      if (error) return fail(ErrorCode.DATABASE_ERROR, 'Save failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'territory.rule_updated',
        targetType: 'territory_rule',
        targetId: null,
        meta: { ruleId: parsed.data.id },
        request,
      })

      return ok({ saved: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/workspace/territories', userId, bridge, requestId)
    }
  },
  { bodySchema: PatchSchema }
)

const DeleteSchema = z.object({ id: z.string().uuid() })

export const DELETE = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'territory_controls' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = DeleteSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const { error } = await supabase.schema('api').from('territory_rules').delete().eq('workspace_id', ws.id).eq('id', parsed.data.id)
      if (error) return fail(ErrorCode.DATABASE_ERROR, 'Delete failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'territory.rule_deleted',
        targetType: 'territory_rule',
        targetId: null,
        meta: { ruleId: parsed.data.id },
        request,
      })

      return ok({ deleted: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/workspace/territories', userId, bridge, requestId)
    }
  },
  { bodySchema: DeleteSchema }
)

