import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { getUserTierForGating } from '@/lib/team/gating'
import { hasCapability } from '@/lib/billing/capabilities'

export const dynamic = 'force-dynamic'

const TourGoalSchema = z.object({
  goal: z.enum(['pipeline', 'conversion', 'expansion']).nullable(),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const supabase = createRouteClient(request, bridge)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    const enabledByTier = hasCapability(tier, 'tour_goals')
    if (!enabledByTier) return ok({ enabledByTier: false, goal: null, selectedAt: null }, undefined, bridge, requestId)

    const { data } = await supabase
      .schema('api')
      .from('user_settings')
      .select('tour_goal, tour_goal_selected_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const row = (data ?? null) as { tour_goal?: unknown; tour_goal_selected_at?: unknown } | null
    const rawGoal = row?.tour_goal
    const goal = rawGoal === 'pipeline' || rawGoal === 'conversion' || rawGoal === 'expansion' ? rawGoal : null
    const selectedAt = typeof row?.tour_goal_selected_at === 'string' ? row.tour_goal_selected_at : null

    return ok({ enabledByTier: true, goal, selectedAt }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/tour-goal', userId, bridge, requestId)
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
      const enabledByTier = hasCapability(tier, 'tour_goals')
      if (!enabledByTier) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', { reason: 'tour_goals_not_enabled' }, undefined, bridge, requestId)
      }

      const parsed = TourGoalSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      const nowIso = new Date().toISOString()
      await supabase
        .schema('api')
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            tour_goal: parsed.data.goal,
            tour_goal_selected_at: parsed.data.goal ? nowIso : null,
            updated_at: nowIso,
          } as never,
          { onConflict: 'user_id' }
        )

      return ok({ ok: true, goal: parsed.data.goal, selectedAt: parsed.data.goal ? nowIso : null }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/tour-goal', userId, bridge, requestId)
    }
  },
  { bodySchema: TourGoalSchema }
)

