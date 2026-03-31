import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { requireCapability } from '@/lib/billing/require-capability'
import { logAudit } from '@/lib/audit/log'
import { signReviewToken } from '@/lib/review/security'

export const dynamic = 'force-dynamic'

const CreateBodySchema = z.object({
  expiresInMinutes: z.coerce.number().int().min(5).max(24 * 60).optional().default(60),
})

const RevokeBodySchema = z.object({
  id: z.string().uuid(),
})

type ReviewLinkRow = {
  id: string
  expires_at: string
  created_at: string
  created_by: string
  revoked_at: string | null
  revoked_by: string | null
  last_used_at: string | null
  use_count: number
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
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
      capability: 'approvals',
    })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    const { data, error } = await supabase
      .schema('api')
      .from('review_links')
      .select('id, expires_at, created_at, created_by, revoked_at, revoked_by, last_used_at, use_count')
      .eq('source_workspace_id', ws.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return fail(ErrorCode.DATABASE_ERROR, 'Failed to load review links', undefined, undefined, bridge, requestId)
    const links = (data ?? []) as unknown as ReviewLinkRow[]
    return ok({ workspaceId: ws.id, links }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/review-links', userId, bridge, requestId)
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

      const gate = await requireCapability({
        userId: user.id,
        sessionEmail: user.email ?? null,
        supabase,
        capability: 'approvals',
      })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = CreateBodySchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const expiresAt = new Date(Date.now() + parsed.data.expiresInMinutes * 60 * 1000)
      const { data: row, error } = await supabase
        .schema('api')
        .from('review_links')
        .insert({
          source_workspace_id: ws.id,
          expires_at: expiresAt.toISOString(),
          created_by: user.id,
        })
        .select('id')
        .single()

      const insertedId = (row as { id?: unknown } | null)?.id
      if (error || !insertedId || typeof insertedId !== 'string') {
        return fail(ErrorCode.DATABASE_ERROR, 'Create failed', undefined, undefined, bridge, requestId)
      }

      const linkId = insertedId
      const exp = Math.floor(expiresAt.getTime() / 1000)
      const secretReady = Boolean((process.env.REVIEW_SIGNING_SECRET ?? '').trim())
      if (!secretReady) {
        return fail(ErrorCode.SERVICE_UNAVAILABLE, 'Review mode not configured', undefined, { status: 424 }, bridge, requestId)
      }
      const token = signReviewToken({ v: 1, aud: 'review_link', linkId, exp })

      const base = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '')
      const links = {
        dashboard: `${base}/review/dashboard?token=${encodeURIComponent(token)}`,
        account_workspace: `${base}/review/account?token=${encodeURIComponent(token)}`,
        reports: `${base}/review/reports?token=${encodeURIComponent(token)}`,
        pricing: `${base}/review/pricing?token=${encodeURIComponent(token)}`,
        upgrade: `${base}/review/upgrade?token=${encodeURIComponent(token)}`,
        settings: `${base}/review/settings?token=${encodeURIComponent(token)}`,
        team: `${base}/review/team?token=${encodeURIComponent(token)}`,
        admin: `${base}/review/admin?token=${encodeURIComponent(token)}`,
      }

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'review_link.created',
        targetType: 'review_link',
        targetId: linkId,
        meta: { expiresAt: expiresAt.toISOString() },
        request,
      })

      return ok({ id: linkId, token, expiresAt: expiresAt.toISOString(), links }, { status: 201 }, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/review-links', userId, bridge, requestId)
    }
  },
  { bodySchema: CreateBodySchema }
)

export const DELETE = withApiGuard(
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
        capability: 'approvals',
      })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = RevokeBodySchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .schema('api')
        .from('review_links')
        .update({ revoked_at: nowIso, revoked_by: user.id })
        .eq('id', parsed.data.id)
        .eq('source_workspace_id', ws.id)
        .is('revoked_at', null)
        .select('id')
        .maybeSingle()

      if (error || !data) {
        return fail(ErrorCode.DATABASE_ERROR, 'Revoke failed', undefined, undefined, bridge, requestId)
      }

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'review_link.revoked',
        targetType: 'review_link',
        targetId: parsed.data.id,
        meta: {},
        request,
      })

      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/review-links', userId, bridge, requestId)
    }
  },
  { bodySchema: RevokeBodySchema }
)

