import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { ApiKeyCreateSchema, ApiKeyRevokeSchema } from '@/lib/domain/api-keys'
import { createWorkspaceApiKey, listWorkspaceApiKeys, revokeWorkspaceApiKey } from '@/lib/services/api-keys'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'
import { requireCapability } from '@/lib/billing/require-capability'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'platform_api_access' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
    if (!policies.platform.apiKeyManageRoles.includes(membership.role)) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    const keys = policies.platform.apiAccessEnabled ? await listWorkspaceApiKeys({ supabase, workspaceId: ws.id }) : []
    await logProductEvent({ userId: user.id, eventName: 'api_settings_viewed', eventProps: { workspaceId: ws.id } })
    return ok({ workspaceId: ws.id, apiAccessEnabled: policies.platform.apiAccessEnabled, keys }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/platform/keys', userId, bridge, requestId)
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

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'platform_api_access' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = ApiKeyCreateSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      if (!policies.platform.apiAccessEnabled) {
        return fail(ErrorCode.FORBIDDEN, 'API access is disabled for this workspace', undefined, undefined, bridge, requestId)
      }
      if (!policies.platform.apiKeyManageRoles.includes(membership.role)) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const allowed = new Set(policies.platform.allowedKeyScopes ?? [])
      for (const s of parsed.data.scopes) {
        if (!allowed.has(s)) {
          return fail(ErrorCode.VALIDATION_ERROR, 'Scope not allowed by workspace policy', { scope: s }, undefined, bridge, requestId)
        }
      }

      const created = await createWorkspaceApiKey({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        name: parsed.data.name,
        scopes: parsed.data.scopes,
      })
      if (!created.ok) {
        return fail(ErrorCode.INTERNAL_ERROR, created.message, undefined, undefined, bridge, requestId)
      }

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'api_key.created',
        targetType: 'api_key',
        targetId: created.apiKeyId,
        meta: { scopes: parsed.data.scopes, prefix: created.prefix },
        request,
      })
      await logProductEvent({ userId: user.id, eventName: 'api_key_created', eventProps: { workspaceId: ws.id, scopesCount: parsed.data.scopes.length } })

      return ok({ apiKeyId: created.apiKeyId, prefix: created.prefix, rawKey: created.rawKey }, { status: 201 }, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/platform/keys', userId, bridge, requestId)
    }
  },
  { bodySchema: ApiKeyCreateSchema }
)

export const DELETE = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'platform_api_access' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = ApiKeyRevokeSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      if (!policies.platform.apiAccessEnabled) {
        return fail(ErrorCode.FORBIDDEN, 'API access is disabled for this workspace', undefined, undefined, bridge, requestId)
      }
      if (!policies.platform.apiKeyManageRoles.includes(membership.role)) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const revoked = await revokeWorkspaceApiKey({ supabase, workspaceId: ws.id, actorUserId: user.id, apiKeyId: parsed.data.id })
      if (!revoked.ok) return fail(ErrorCode.DATABASE_ERROR, 'Revoke failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'api_key.revoked',
        targetType: 'api_key',
        targetId: parsed.data.id,
        meta: {},
        request,
      })
      await logProductEvent({ userId: user.id, eventName: 'api_key_revoked', eventProps: { workspaceId: ws.id } })

      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/platform/keys', userId, bridge, requestId)
    }
  },
  { bodySchema: ApiKeyRevokeSchema }
)

