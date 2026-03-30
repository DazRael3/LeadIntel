import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { getUserTierForGating } from '@/lib/team/gating'
import { hasCapability } from '@/lib/billing/capabilities'
import { getActiveWorkspaceIdForUser, ensureDefaultWatchlist, listWatchlistItems, updateWatchlistItem } from '@/lib/watchlists-v2/service'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  watchlistId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
})

const PatchSchema = z
  .object({
    itemId: z.string().uuid(),
    note: z.string().max(2000).nullable().optional(),
    reminderAt: z.string().datetime().nullable().optional(),
    reminderStatus: z.enum(['none', 'scheduled', 'shown', 'dismissed', 'completed']).optional(),
  })
  .strict()

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!hasCapability(tier, 'multi_watchlists')) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const url = new URL(request.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    const wsRes = await getActiveWorkspaceIdForUser({ supabase, userId: user.id })
    if (!wsRes.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', { reason: wsRes.reason }, undefined, bridge, requestId)

    // Ensure default exists for a stable first run.
    await ensureDefaultWatchlist({ supabase, workspaceId: wsRes.workspaceId, createdBy: user.id })

    const items = await listWatchlistItems({
      supabase,
      workspaceId: wsRes.workspaceId,
      watchlistId: parsed.data.watchlistId,
      limit: parsed.data.limit,
    })

    return ok(
      {
        workspaceId: wsRes.workspaceId,
        items: items.map((i) => ({
          id: i.row.id,
          watchlistId: i.row.watchlist_id,
          leadId: i.row.lead_id,
          note: i.row.note,
          reminderAt: i.row.reminder_at,
          reminderStatus: i.reminderStatus,
          reminderLastShownAt: i.row.reminder_last_shown_at,
          createdAt: i.row.created_at,
          lead: i.row.leads
            ? {
                id: i.row.leads.id,
                companyName: i.row.leads.company_name,
                companyDomain: i.row.leads.company_domain,
                companyUrl: i.row.leads.company_url,
              }
            : null,
        })),
      },
      undefined,
      bridge,
      requestId
    )
  } catch (e) {
    return asHttpError(e, '/api/lead-watchlists/items', userId, bridge, requestId)
  }
})

export const PATCH = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!hasCapability(tier, 'multi_watchlists')) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = PatchSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      const wsRes = await getActiveWorkspaceIdForUser({ supabase, userId: user.id })
      if (!wsRes.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', { reason: wsRes.reason }, undefined, bridge, requestId)

      const patch: Record<string, unknown> = {}
      if ('note' in parsed.data) patch.note = parsed.data.note ?? null
      if ('reminderAt' in parsed.data) patch.reminder_at = parsed.data.reminderAt ?? null
      if (parsed.data.reminderStatus) patch.reminder_status = parsed.data.reminderStatus

      const res = await updateWatchlistItem({
        supabase,
        workspaceId: wsRes.workspaceId,
        itemId: parsed.data.itemId,
        patch: patch as {
          note?: string | null
          reminder_at?: string | null
          reminder_status?: 'none' | 'scheduled' | 'shown' | 'dismissed' | 'completed'
        },
      })
      if (!res.ok) return fail(ErrorCode.DATABASE_ERROR, 'Failed to update item', undefined, undefined, bridge, requestId)

      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/lead-watchlists/items', userId, bridge, requestId)
    }
  },
  { bodySchema: PatchSchema }
)

