import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { getUserTierForGating } from '@/lib/team/gating'
import { hasCapability } from '@/lib/billing/capabilities'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { deliverInAppWhyNowDigest } from '@/lib/services/in-app-digest'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const PostSchema = z.object({
  action: z.enum(['refresh']),
})

type NotificationRow = {
  id: string
  created_at: string
  read_at: string | null
  body: string | null
  meta: unknown
  event_type: string
}

function safeMeta(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const supabase = createRouteClient(request, bridge)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    const enabledByTier = hasCapability(tier, 'why_now_digest_in_app')
    if (!enabledByTier) return ok({ enabledByTier: false, items: [] }, undefined, bridge, requestId)

    // Read only recipient rows (RLS enforced).
    const { data, error } = await supabase
      .schema('api')
      .from('notifications')
      .select('id, created_at, read_at, body, meta, event_type')
      .eq('to_user_id', user.id)
      .eq('event_type', 'digest.why_now')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return ok({ enabledByTier: true, items: [] }, undefined, bridge, requestId)
    }

    const rows = (data ?? []) as unknown as NotificationRow[]
    const items = rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      readAt: r.read_at,
      body: r.body,
      meta: safeMeta(r.meta),
    }))

    return ok({ enabledByTier: true, items }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/digest/in-app', userId, bridge, requestId)
  }
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const supabase = createRouteClient(request, bridge)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      const enabledByTier = hasCapability(tier, 'why_now_digest_in_app')
      if (!enabledByTier) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = PostSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      // Use admin client to insert notification (notifications table blocks insert for authed).
      const admin = createSupabaseAdminClient({ schema: 'api' })
      const correlationId = `in_app_digest:${requestId ?? new Date().toISOString()}:${user.id}`
      const res = await deliverInAppWhyNowDigest({ supabaseAdmin: admin, userId: user.id, correlationId, force: true })
      if (!res.ok) return fail(ErrorCode.INTERNAL_ERROR, 'Digest unavailable', { reason: res.reason }, undefined, bridge, requestId)

      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/digest/in-app', userId, bridge, requestId)
    }
  },
  { bodySchema: PostSchema }
)

