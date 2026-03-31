import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { getUserTierForGating } from '@/lib/team/gating'
import { hasCapability } from '@/lib/billing/capabilities'
import { getActiveWorkspaceIdForUser, ensureDefaultWatchlist, listWatchlists } from '@/lib/watchlists-v2/service'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const supabase = createRouteClient(request, bridge)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!hasCapability(tier, 'multi_watchlists')) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', { reason: 'multi_watchlists_not_enabled' }, undefined, bridge, requestId)
    }

    const wsRes = await getActiveWorkspaceIdForUser({ supabase, userId: user.id })
    if (!wsRes.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', { reason: wsRes.reason }, undefined, bridge, requestId)

    // Ensure default exists (idempotent).
    await ensureDefaultWatchlist({ supabase, workspaceId: wsRes.workspaceId, createdBy: user.id }).catch(() => undefined)
    const lists = await listWatchlists({ supabase, workspaceId: wsRes.workspaceId })
    return ok({ workspaceId: wsRes.workspaceId, watchlists: lists }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/lead-watchlists', userId, bridge, requestId)
  }
})

const CreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).optional().nullable(),
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
      if (!hasCapability(tier, 'multi_watchlists')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', { reason: 'multi_watchlists_not_enabled' }, undefined, bridge, requestId)
      }

      const parsed = CreateSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      const wsRes = await getActiveWorkspaceIdForUser({ supabase, userId: user.id })
      if (!wsRes.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', { reason: wsRes.reason }, undefined, bridge, requestId)

      const { data, error } = await supabase
        .schema('api')
        .from('watchlists')
        .insert(
          {
            workspace_id: wsRes.workspaceId,
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            is_default: false,
            created_by: user.id,
          } as never,
          { count: 'exact' }
        )
        .select('id, name, description, is_default, created_at, updated_at')
        .single()

      if (error || !data) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to create watchlist', undefined, undefined, bridge, requestId)
      }

      return ok({ watchlist: data }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/lead-watchlists', userId, bridge, requestId)
    }
  },
  { bodySchema: CreateSchema }
)

