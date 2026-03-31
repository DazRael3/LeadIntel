import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const GrantSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['admin', 'manager', 'rep', 'viewer']).default('viewer'),
  note: z.string().trim().max(500).optional().nullable(),
})

const RevokeSchema = z.object({
  granteeUserId: z.string().uuid(),
})

type GrantRow = {
  id: string
  workspace_id: string
  grantee_user_id: string
  granted_role: string
  granted_at: string
  granted_by: string
  revoked_at: string | null
  revoked_by: string | null
  note: string | null
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'partner_dashboard' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    const { data: grants } = await supabase
      .schema('api')
      .from('delegated_access_grants')
      .select('id, workspace_id, grantee_user_id, granted_role, granted_at, granted_by, revoked_at, revoked_by, note')
      .eq('workspace_id', ws.id)
      .order('granted_at', { ascending: false })
      .limit(200)

    const rows = (grants ?? []) as unknown as GrantRow[]
    const ids = Array.from(new Set(rows.map((r) => r.grantee_user_id)))

    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { data: users } = await admin.from('users').select('id, email').in('id', ids).limit(2000)
    const emailById = new Map<string, string>()
    for (const u of (users ?? []) as unknown as Array<{ id?: unknown; email?: unknown }>) {
      if (typeof u.id === 'string' && typeof u.email === 'string') emailById.set(u.id, u.email)
    }

    await logProductEvent({ userId: user.id, eventName: 'partner_access_settings_viewed', eventProps: { workspaceId: ws.id } })

    return ok(
      {
        workspaceId: ws.id,
        grants: rows.map((g) => ({ ...g, email: emailById.get(g.grantee_user_id) ?? null })),
      },
      undefined,
      bridge,
      requestId
    )
  } catch (e) {
    return asHttpError(e, '/api/settings/partner-access', userId, bridge, requestId)
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

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'partner_dashboard' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = GrantSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const email = parsed.data.email.toLowerCase()
      const admin = createSupabaseAdminClient({ schema: 'api' })
      const { data: grantee } = await admin.from('users').select('id').eq('email', email).maybeSingle()
      const granteeUserId = (grantee as { id?: unknown } | null)?.id
      if (typeof granteeUserId !== 'string') {
        return fail(ErrorCode.VALIDATION_ERROR, 'User not found', { email: 'User must sign up first.' }, undefined, bridge, requestId)
      }

      const { data: existingMember } = await supabase
        .schema('api')
        .from('workspace_members')
        .select('membership_source, role')
        .eq('workspace_id', ws.id)
        .eq('user_id', granteeUserId)
        .maybeSingle()
      const existingSource = (existingMember as { membership_source?: unknown } | null)?.membership_source
      if (existingSource === 'direct') {
        return fail(ErrorCode.VALIDATION_ERROR, 'Already a member', { email: 'This user is already a direct workspace member.' }, undefined, bridge, requestId)
      }

      // Upsert membership as delegated so workspace-scoped RLS applies in that workspace.
      const { error: memberError } = await supabase.schema('api').from('workspace_members').upsert(
        {
          workspace_id: ws.id,
          user_id: granteeUserId,
          role: parsed.data.role,
          membership_source: 'delegated',
        },
        { onConflict: 'workspace_id,user_id' }
      )
      if (memberError) return fail(ErrorCode.DATABASE_ERROR, 'Grant failed', undefined, undefined, bridge, requestId)

      const { error: grantError } = await supabase.schema('api').from('delegated_access_grants').upsert(
        {
          workspace_id: ws.id,
          grantee_user_id: granteeUserId,
          granted_role: parsed.data.role,
          scopes: {},
          granted_by: user.id,
          revoked_at: null,
          revoked_by: null,
          note: parsed.data.note ?? null,
        },
        { onConflict: 'workspace_id,grantee_user_id' }
      )
      if (grantError) return fail(ErrorCode.DATABASE_ERROR, 'Grant failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'delegated_access.granted',
        targetType: 'user',
        targetId: granteeUserId,
        meta: { role: parsed.data.role },
        request,
      })
      await logProductEvent({ userId: user.id, eventName: 'delegated_access_granted', eventProps: { workspaceId: ws.id, granteeUserId, role: parsed.data.role } })

      return ok({ ok: true }, { status: 201 }, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/settings/partner-access', userId, bridge, requestId)
    }
  },
  { bodySchema: GrantSchema }
)

export const DELETE = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'partner_dashboard' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = RevokeSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      await supabase
        .schema('api')
        .from('delegated_access_grants')
        .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
        .eq('workspace_id', ws.id)
        .eq('grantee_user_id', parsed.data.granteeUserId)

      await supabase
        .schema('api')
        .from('workspace_members')
        .delete()
        .eq('workspace_id', ws.id)
        .eq('user_id', parsed.data.granteeUserId)
        .eq('membership_source', 'delegated')

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'delegated_access.revoked',
        targetType: 'user',
        targetId: parsed.data.granteeUserId,
        meta: {},
        request,
      })
      await logProductEvent({ userId: user.id, eventName: 'delegated_access_revoked', eventProps: { workspaceId: ws.id, granteeUserId: parsed.data.granteeUserId } })

      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/settings/partner-access', userId, bridge, requestId)
    }
  },
  { bodySchema: RevokeSchema }
)

