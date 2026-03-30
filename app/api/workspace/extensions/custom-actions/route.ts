import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { createCustomAction, listCustomActions, setCustomActionEnabled } from '@/lib/services/custom-actions'
import { validatePayloadTemplate } from '@/lib/extensions/validators'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).nullable().optional(),
  endpointId: z.string().uuid(),
  payloadTemplate: z.record(z.unknown()),
})

const PatchSchema = z.object({
  id: z.string().uuid(),
  isEnabled: z.boolean(),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'extensions' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    if (!policies.platform.extensionsEnabled) {
      return ok({ workspaceId: ws.id, extensionsEnabled: false, actions: [] }, undefined, bridge, requestId)
    }

    const actions = await listCustomActions({ supabase, workspaceId: ws.id })
    await logProductEvent({ userId: user.id, eventName: 'extension_catalog_viewed', eventProps: { workspaceId: ws.id } })
    return ok({ workspaceId: ws.id, extensionsEnabled: true, role: membership.role, actions }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/extensions/custom-actions', userId, bridge, requestId)
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

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'extensions' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = CreateSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      const validity = validatePayloadTemplate(parsed.data.payloadTemplate)
      if (!validity.ok) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid payload template', { reason: validity.reason }, undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      if (!policies.platform.extensionsEnabled) {
        return fail(ErrorCode.FORBIDDEN, 'Extensions disabled for this workspace', undefined, undefined, bridge, requestId)
      }

      const created = await createCustomAction({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        endpointId: parsed.data.endpointId,
        payloadTemplate: parsed.data.payloadTemplate,
      })
      if (!created.ok) return fail(ErrorCode.DATABASE_ERROR, 'Create failed', { reason: created.reason }, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'custom_action.created',
        targetType: 'custom_action',
        targetId: created.action.id,
        meta: { endpointId: parsed.data.endpointId, name: parsed.data.name },
        request,
      })
      await logProductEvent({ userId: user.id, eventName: 'custom_action_created', eventProps: { workspaceId: ws.id } })

      return ok({ action: created.action }, { status: 201 }, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/workspace/extensions/custom-actions', userId, bridge, requestId)
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

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'extensions' })
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

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      if (!policies.platform.extensionsEnabled) {
        return fail(ErrorCode.FORBIDDEN, 'Extensions disabled for this workspace', undefined, undefined, bridge, requestId)
      }

      const updated = await setCustomActionEnabled({ supabase, workspaceId: ws.id, actionId: parsed.data.id, isEnabled: parsed.data.isEnabled })
      if (!updated.ok) return fail(ErrorCode.DATABASE_ERROR, 'Update failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'custom_action.updated',
        targetType: 'custom_action',
        targetId: parsed.data.id,
        meta: { isEnabled: parsed.data.isEnabled },
        request,
      })

      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/workspace/extensions/custom-actions', userId, bridge, requestId)
    }
  },
  { bodySchema: PatchSchema }
)

