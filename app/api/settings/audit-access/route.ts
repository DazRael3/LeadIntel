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
  tier: z.enum(['closer', 'closer_plus', 'team']),
  expiresInMinutes: z.number().int().min(5).max(60 * 24 * 30).optional(),
  note: z.string().trim().max(500).optional().nullable(),
})

const RevokeSchema = z.object({
  granteeUserId: z.string().uuid(),
})

type GrantRow = {
  id: string
  workspace_id: string
  grantee_user_id: string
  granted_tier: 'closer' | 'closer_plus' | 'team'
  previous_subscription_tier: string | null
  expires_at: string | null
  granted_at: string
  granted_by: string
  revoked_at: string | null
  revoked_by: string | null
  note: string | null
}

function subscriptionTierForGrantedTier(tier: 'closer' | 'closer_plus' | 'team'): 'pro' | 'closer_plus' | 'team' {
  if (tier === 'closer') return 'pro'
  if (tier === 'closer_plus') return 'closer_plus'
  return 'team'
}

async function assertActorCanManage(args: { request: NextRequest; userId: string; supabase: ReturnType<typeof createRouteClient> }) {
  await ensurePersonalWorkspace({ supabase: args.supabase, userId: args.userId })
  const ws = await getCurrentWorkspace({ supabase: args.supabase, userId: args.userId })
  if (!ws) return { ok: false as const, reason: 'Workspace unavailable', ws: null }

  const membership = await getWorkspaceMembership({ supabase: args.supabase, workspaceId: ws.id, userId: args.userId })
  if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
    return { ok: false as const, reason: 'Access restricted', ws }
  }

  return { ok: true as const, ws }
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'audit_log' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const can = await assertActorCanManage({ request, userId: user.id, supabase })
    if (!can.ok || !can.ws) return fail(ErrorCode.FORBIDDEN, can.reason, undefined, undefined, bridge, requestId)

    const { data: grants } = await supabase
      .schema('api')
      .from('audit_tier_grants')
      .select(
        'id, workspace_id, grantee_user_id, granted_tier, previous_subscription_tier, expires_at, granted_at, granted_by, revoked_at, revoked_by, note'
      )
      .eq('workspace_id', can.ws.id)
      .order('granted_at', { ascending: false })
      .limit(200)

    const rows = (grants ?? []) as unknown as GrantRow[]
    const ids = Array.from(new Set(rows.map((r) => r.grantee_user_id)))

    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { data: users } = await admin.from('users').select('id, email, subscription_tier').in('id', ids).limit(2000)
    const byId = new Map<string, { email: string | null; subscription_tier: string | null }>()
    for (const u of (users ?? []) as unknown as Array<{ id?: unknown; email?: unknown; subscription_tier?: unknown }>) {
      const id = typeof u.id === 'string' ? u.id : null
      if (!id) continue
      byId.set(id, {
        email: typeof u.email === 'string' ? u.email : null,
        subscription_tier: typeof u.subscription_tier === 'string' ? u.subscription_tier : null,
      })
    }

    await logProductEvent({ userId: user.id, eventName: 'audit_access_settings_viewed', eventProps: { workspaceId: can.ws.id } })

    return ok(
      {
        workspaceId: can.ws.id,
        grants: rows.map((g) => ({
          ...g,
          email: byId.get(g.grantee_user_id)?.email ?? null,
          current_subscription_tier: byId.get(g.grantee_user_id)?.subscription_tier ?? null,
        })),
      },
      undefined,
      bridge,
      requestId
    )
  } catch (e) {
    return asHttpError(e, '/api/settings/audit-access', userId, bridge, requestId)
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

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'audit_log' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = GrantSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      const can = await assertActorCanManage({ request, userId: user.id, supabase })
      if (!can.ok || !can.ws) return fail(ErrorCode.FORBIDDEN, can.reason, undefined, undefined, bridge, requestId)

      const admin = createSupabaseAdminClient({ schema: 'api' })
      const email = parsed.data.email.toLowerCase()
      const { data: grantee } = await admin.from('users').select('id, subscription_tier').eq('email', email).maybeSingle()
      const granteeUserId = (grantee as { id?: unknown } | null)?.id
      if (typeof granteeUserId !== 'string') {
        return fail(ErrorCode.VALIDATION_ERROR, 'User not found', { email: 'User must sign up first.' }, undefined, bridge, requestId)
      }

      // Do not override if Stripe says the user is already active/trialing (avoid billing conflicts).
      const { data: subs } = await admin
        .from('subscriptions')
        .select('status')
        .eq('user_id', granteeUserId)
        .in('status', ['active', 'trialing'])
        .limit(1)
      if (Array.isArray(subs) && subs.length > 0) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'User already has a paid plan',
          { email: 'This user has an active/trialing subscription. Use normal billing instead of audit access.' },
          undefined,
          bridge,
          requestId
        )
      }

      const currentTier = (grantee as { subscription_tier?: unknown } | null)?.subscription_tier
      const previous =
        typeof currentTier === 'string' && currentTier.length > 0 ? currentTier : 'free'
      const nextTier = subscriptionTierForGrantedTier(parsed.data.tier)

      // Upsert grant record. If an active grant already exists, keep the original previous tier.
      const { data: existingGrant } = await admin
        .from('audit_tier_grants')
        .select('previous_subscription_tier, revoked_at')
        .eq('workspace_id', can.ws.id)
        .eq('grantee_user_id', granteeUserId)
        .maybeSingle()
      const existingPrev = (existingGrant as { previous_subscription_tier?: unknown; revoked_at?: unknown } | null)?.previous_subscription_tier
      const existingRevoked = (existingGrant as { revoked_at?: unknown } | null)?.revoked_at
      const prevToStore =
        existingRevoked == null && typeof existingPrev === 'string' && existingPrev.length > 0 ? existingPrev : previous

      const expiresAt =
        typeof parsed.data.expiresInMinutes === 'number'
          ? new Date(Date.now() + parsed.data.expiresInMinutes * 60 * 1000).toISOString()
          : null

      const { error: grantError } = await admin.from('audit_tier_grants').upsert(
        {
          workspace_id: can.ws.id,
          grantee_user_id: granteeUserId,
          granted_tier: parsed.data.tier,
          previous_subscription_tier: prevToStore,
          expires_at: expiresAt,
          granted_by: user.id,
          revoked_at: null,
          revoked_by: null,
          note: parsed.data.note ?? null,
        },
        { onConflict: 'workspace_id,grantee_user_id' }
      )
      if (grantError) return fail(ErrorCode.DATABASE_ERROR, 'Grant failed', undefined, undefined, bridge, requestId)

      // Apply tier override for the grantee (global per-user tier used by gating).
      const { error: tierError } = await admin.from('users').update({ subscription_tier: nextTier }).eq('id', granteeUserId)
      if (tierError) return fail(ErrorCode.DATABASE_ERROR, 'Grant failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: can.ws.id,
        actorUserId: user.id,
        action: 'audit_access.granted',
        targetType: 'user',
        targetId: granteeUserId,
        meta: { tier: parsed.data.tier, expiresAt },
        request,
      })
      await logProductEvent({
        userId: user.id,
        eventName: 'audit_access_granted',
        eventProps: { workspaceId: can.ws.id, granteeUserId, tier: parsed.data.tier, expiresAt },
      })

      return ok({ ok: true }, { status: 201 }, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/settings/audit-access', userId, bridge, requestId)
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

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'audit_log' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = RevokeSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      const can = await assertActorCanManage({ request, userId: user.id, supabase })
      if (!can.ok || !can.ws) return fail(ErrorCode.FORBIDDEN, can.reason, undefined, undefined, bridge, requestId)

      const admin = createSupabaseAdminClient({ schema: 'api' })
      const { data: grant } = await admin
        .from('audit_tier_grants')
        .select('id, previous_subscription_tier, granted_tier, revoked_at')
        .eq('workspace_id', can.ws.id)
        .eq('grantee_user_id', parsed.data.granteeUserId)
        .maybeSingle()

      const row = (grant as { id?: unknown; previous_subscription_tier?: unknown; granted_tier?: unknown; revoked_at?: unknown } | null) ?? null
      if (!row || typeof row.id !== 'string') {
        return fail(ErrorCode.NOT_FOUND, 'Grant not found', undefined, { status: 404 }, bridge, requestId)
      }
      if (row.revoked_at) {
        return ok({ ok: true }, undefined, bridge, requestId)
      }

      await admin
        .from('audit_tier_grants')
        .update({ revoked_at: new Date().toISOString(), revoked_by: user.id })
        .eq('id', row.id)

      // Restore previous tier only if user has no active/trialing Stripe subscription.
      const { data: subs } = await admin
        .from('subscriptions')
        .select('status')
        .eq('user_id', parsed.data.granteeUserId)
        .in('status', ['active', 'trialing'])
        .limit(1)

      const hasPaidSub = Array.isArray(subs) && subs.length > 0
      if (!hasPaidSub) {
        const prev = typeof row.previous_subscription_tier === 'string' && row.previous_subscription_tier.length > 0 ? row.previous_subscription_tier : 'free'
        await admin.from('users').update({ subscription_tier: prev }).eq('id', parsed.data.granteeUserId)
      }

      await logAudit({
        supabase,
        workspaceId: can.ws.id,
        actorUserId: user.id,
        action: 'audit_access.revoked',
        targetType: 'user',
        targetId: parsed.data.granteeUserId,
        meta: { restored: !hasPaidSub },
        request,
      })
      await logProductEvent({
        userId: user.id,
        eventName: 'audit_access_revoked',
        eventProps: { workspaceId: can.ws.id, granteeUserId: parsed.data.granteeUserId },
      })

      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/settings/audit-access', userId, bridge, requestId)
    }
  },
  { bodySchema: RevokeSchema }
)

