import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { serverEnv } from '@/lib/env'
import { logProductEvent } from '@/lib/services/analytics'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { canViewGrowthInsights } from '@/lib/experiments/permissions'
import { isGrowthEventName } from '@/lib/growth-events/definitions'
import { sanitizeGrowthEventProps } from '@/lib/growth-events/validators'

export const dynamic = 'force-dynamic'

const TrackBodySchema = z.object({
  eventName: z.string().trim().min(1).max(64),
  eventProps: z.record(z.string(), z.unknown()).optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const enabled = serverEnv.ENABLE_PRODUCT_ANALYTICS === '1' || serverEnv.ENABLE_PRODUCT_ANALYTICS === 'true'
      if (!enabled) {
        return ok({ ok: true }, undefined, bridge, requestId)
      }

      const parsed = body as z.infer<typeof TrackBodySchema>
      await logProductEvent({
        userId,
        eventName: parsed.eventName,
        eventProps: parsed.eventProps ?? {},
      })

      // Secondary: workspace-scoped growth event capture (queryable, sanitized).
      // Only capture for a bounded allowlist and never store nested objects.
      try {
        if (isGrowthEventName(parsed.eventName)) {
          const supabase = createRouteClient(request, bridge)
          const user = await getUserSafe(supabase)
          if (user) {
            await ensurePersonalWorkspace({ supabase, userId: user.id })
            const ws = await getCurrentWorkspace({ supabase, userId: user.id })
            if (ws) {
              const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
              if (membership) {
                const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
                // Capture only when viewer roles are allowed to see growth insights (prevents noisy capture in minimal workspaces).
                if (canViewGrowthInsights({ policies, role: membership.role })) {
                  const props = sanitizeGrowthEventProps(parsed.eventProps ?? {})
                  const rawDedupe = typeof (props as { dedupeKey?: unknown }).dedupeKey === 'string' ? (props as { dedupeKey: string }).dedupeKey : null
                  const dedupeKey = rawDedupe && rawDedupe.trim().length > 0 ? rawDedupe.trim().slice(0, 128) : null
                  await supabase.schema('api').from('growth_events').insert({
                    workspace_id: ws.id,
                    user_id: user.id,
                    event_name: parsed.eventName,
                    event_props: props,
                    dedupe_key: dedupeKey,
                  })
                }
              }
            }
          }
        }
      } catch {
        // best-effort
      }
      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (err) {
      return asHttpError(err, '/api/analytics/track', undefined, bridge, requestId)
    }
  },
  { bodySchema: TrackBodySchema }
)

