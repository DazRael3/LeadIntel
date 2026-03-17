import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getQaOverrideConfig, isQaActorAllowed, isQaTargetAllowed } from '@/lib/qa/overrides'
import { logAudit } from '@/lib/audit/log'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'

export const dynamic = 'force-dynamic'

const UpsertSchema = z.object({
  targetEmail: z.string().trim().email(),
  tier: z.enum(['starter', 'closer', 'closer_plus', 'team']),
  expiresInMinutes: z.number().int().min(5).max(60 * 24 * 30).optional(),
  note: z.string().trim().max(500).optional().nullable(),
})

const RevokeSchema = z.object({
  targetEmail: z.string().trim().email(),
})

type OverrideRow = {
  id: string
  target_user_id: string
  override_tier: 'starter' | 'closer' | 'closer_plus' | 'team'
  expires_at: string | null
  created_by: string
  created_at: string
  revoked_at: string | null
  revoked_by: string | null
  note: string | null
}

function configErrorResponse(args: {
  cfg: ReturnType<typeof getQaOverrideConfig>
  bridge: ReturnType<typeof createCookieBridge>
  requestId: string
}) {
  if (!args.cfg.enabled) {
    return ok(
      {
        enabled: false,
        configured: false,
        misconfigReason: null,
        overrides: [],
      },
      undefined,
      args.bridge,
      args.requestId
    )
  }
  if (!args.cfg.configured) {
    return ok(
      {
        enabled: true,
        configured: false,
        misconfigReason: args.cfg.misconfigReason ?? 'Explicit allowlists are not configured.',
        overrides: [],
      },
      undefined,
      args.bridge,
      args.requestId
    )
  }
  return null
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)

  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const actor = await getUserSafe(supabase)
    if (!actor || !actor.email) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const cfg = getQaOverrideConfig()
    const cfgRes = configErrorResponse({ cfg, bridge, requestId })
    if (cfgRes) return cfgRes

    // Read access does not require a workspace. This page should load even if the actor has no current workspace yet.
    if (!isQaActorAllowed(actor.email)) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, { status: 403 }, bridge, requestId)
    }

    // Diagnostics only (no IDs returned): whether a workspace exists and whether actor is owner/admin there.
    let workspaceStatus: { exists: boolean; role: 'owner_admin' | 'member' | 'unknown' } = { exists: false, role: 'unknown' }
    try {
      const ws = await getCurrentWorkspace({ supabase, userId: actor.id })
      if (ws) {
        const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: actor.id })
        if (membership && (membership.role === 'owner' || membership.role === 'admin')) {
          workspaceStatus = { exists: true, role: 'owner_admin' }
        } else if (membership) {
          workspaceStatus = { exists: true, role: 'member' }
        } else {
          workspaceStatus = { exists: true, role: 'unknown' }
        }
      } else {
        workspaceStatus = { exists: false, role: 'unknown' }
      }
    } catch {
      workspaceStatus = { exists: false, role: 'unknown' }
    }

    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { data: rows } = await admin
      .from('qa_tier_overrides')
      .select('id,target_user_id,override_tier,expires_at,created_by,created_at,revoked_at,revoked_by,note')
      .order('created_at', { ascending: false })
      .limit(100)

    const overrides = (rows ?? []) as unknown as OverrideRow[]
    const ids = Array.from(new Set(overrides.map((r) => r.target_user_id)))
    const { data: users } = await admin.from('users').select('id,email').in('id', ids).limit(1000)
    const byId = new Map<string, string | null>()
    for (const u of (users ?? []) as unknown as Array<{ id?: unknown; email?: unknown }>) {
      const id = typeof u.id === 'string' ? u.id : null
      if (!id) continue
      byId.set(id, typeof u.email === 'string' ? u.email : null)
    }

    return ok(
      {
        enabled: cfg.enabled,
        configured: cfg.configured,
        misconfigReason: cfg.misconfigReason,
        actor: { allowlisted: true },
        workspace: workspaceStatus,
        api: { ready: true },
        overrides: overrides.map((o) => ({
          ...o,
          target_email: byId.get(o.target_user_id) ?? null,
        })),
      },
      undefined,
      bridge,
      requestId
    )
  } catch (e) {
    return asHttpError(e, '/api/qa/overrides', userId, bridge, requestId)
  }
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)

    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const actor = await getUserSafe(supabase)
      if (!actor || !actor.email) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const cfg = getQaOverrideConfig()
      if (!cfg.enabled) {
        return fail(ErrorCode.NOT_FOUND, 'Not available', undefined, { status: 404 }, bridge, requestId)
      }
      if (!cfg.configured) {
        return fail(
          ErrorCode.SERVICE_UNAVAILABLE,
          'QA overrides are enabled, but explicit allowlists are not configured.',
          undefined,
          { status: 503 },
          bridge,
          requestId
        )
      }
      if (!isQaActorAllowed(actor.email)) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, { status: 403 }, bridge, requestId)
      }

      const parsed = UpsertSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      if (!isQaTargetAllowed(parsed.data.targetEmail)) {
        return fail(
          ErrorCode.FORBIDDEN,
          'Access restricted',
          { targetEmail: 'Target must be an allowlisted internal test account.' },
          undefined,
          bridge,
          requestId
        )
      }

      const ws = await getCurrentWorkspace({ supabase, userId: actor.id })
      if (!ws) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'Workspace required',
          { workspace: 'Create or select a workspace before managing QA overrides.' },
          { status: 422 },
          bridge,
          requestId
        )
      }
      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: actor.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, { status: 403 }, bridge, requestId)
      }

      const admin = createSupabaseAdminClient({ schema: 'api' })
      const targetEmail = parsed.data.targetEmail.toLowerCase()
      const { data: target } = await admin.from('users').select('id').eq('email', targetEmail).maybeSingle()
      const targetUserId = (target as { id?: unknown } | null)?.id
      if (typeof targetUserId !== 'string') {
        return fail(ErrorCode.VALIDATION_ERROR, 'User not found', { targetEmail: 'User must sign up first.' }, undefined, bridge, requestId)
      }

      const expiresAt =
        typeof parsed.data.expiresInMinutes === 'number'
          ? new Date(Date.now() + parsed.data.expiresInMinutes * 60 * 1000).toISOString()
          : null

      const { error } = await admin
        .from('qa_tier_overrides')
        .upsert(
          {
            target_user_id: targetUserId,
            override_tier: parsed.data.tier,
            expires_at: expiresAt,
            created_by: actor.id,
            revoked_at: null,
            revoked_by: null,
            note: parsed.data.note ?? null,
          },
          { onConflict: 'target_user_id' }
        )
      if (error) return fail(ErrorCode.DATABASE_ERROR, 'Override failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: actor.id,
        action: 'qa_override.set',
        targetType: 'user',
        targetId: targetUserId,
        meta: { tier: parsed.data.tier, expiresAt, targetEmail },
        request,
      })

      return ok({ saved: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/qa/overrides', userId, bridge, requestId)
    }
  },
  { bodySchema: UpsertSchema }
)

export const DELETE = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)

    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const actor = await getUserSafe(supabase)
      if (!actor || !actor.email) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const cfg = getQaOverrideConfig()
      if (!cfg.enabled) {
        return fail(ErrorCode.NOT_FOUND, 'Not available', undefined, { status: 404 }, bridge, requestId)
      }
      if (!cfg.configured) {
        return fail(
          ErrorCode.SERVICE_UNAVAILABLE,
          'QA overrides are enabled, but explicit allowlists are not configured.',
          undefined,
          { status: 503 },
          bridge,
          requestId
        )
      }
      if (!isQaActorAllowed(actor.email)) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, { status: 403 }, bridge, requestId)
      }

      const parsed = RevokeSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      if (!isQaTargetAllowed(parsed.data.targetEmail)) {
        return fail(
          ErrorCode.FORBIDDEN,
          'Access restricted',
          { targetEmail: 'Target must be an allowlisted internal test account.' },
          undefined,
          bridge,
          requestId
        )
      }

      const ws = await getCurrentWorkspace({ supabase, userId: actor.id })
      if (!ws) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'Workspace required',
          { workspace: 'Create or select a workspace before managing QA overrides.' },
          { status: 422 },
          bridge,
          requestId
        )
      }
      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: actor.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, { status: 403 }, bridge, requestId)
      }

      const admin = createSupabaseAdminClient({ schema: 'api' })
      const targetEmail = parsed.data.targetEmail.toLowerCase()
      const { data: target } = await admin.from('users').select('id').eq('email', targetEmail).maybeSingle()
      const targetUserId = (target as { id?: unknown } | null)?.id
      if (typeof targetUserId !== 'string') {
        return ok({ saved: true }, undefined, bridge, requestId)
      }

      const { error } = await admin
        .from('qa_tier_overrides')
        .update({ revoked_at: new Date().toISOString(), revoked_by: actor.id })
        .eq('target_user_id', targetUserId)
        .is('revoked_at', null)

      if (error) return fail(ErrorCode.DATABASE_ERROR, 'Revoke failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: actor.id,
        action: 'qa_override.revoked',
        targetType: 'user',
        targetId: targetUserId,
        meta: { targetEmail },
        request,
      })

      return ok({ saved: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/qa/overrides', userId, bridge, requestId)
    }
  },
  { bodySchema: RevokeSchema }
)

