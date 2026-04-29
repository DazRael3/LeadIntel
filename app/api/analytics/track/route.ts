import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, createCookieBridge } from '@/lib/api/http'
import { serverEnv } from '@/lib/env'
import { logProductEvent } from '@/lib/services/analytics'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { isGrowthEventName } from '@/lib/growth-events/definitions'
import { sanitizeGrowthEventProps } from '@/lib/growth-events/validators'
import { normalizeFunnelEventName } from '@/lib/analytics/funnel-events'
import { logInfo, logWarn } from '@/lib/observability/logger'

export const dynamic = 'force-dynamic'

const TrackBodySchema = z.object({
  eventName: z.string().trim().min(1).max(64),
  eventProps: z.record(z.string(), z.unknown()).optional(),
  eventAt: z.string().datetime().optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    logInfo({
      scope: 'analytics',
      message: 'analytics.track.start',
      requestId,
    })
    try {
      const enabled = serverEnv.ENABLE_PRODUCT_ANALYTICS === '1' || serverEnv.ENABLE_PRODUCT_ANALYTICS === 'true'
      if (!enabled) {
        logInfo({
          scope: 'analytics',
          message: 'analytics.track.skipped',
          requestId,
          reason: 'analytics_disabled',
        })
        return ok({ ok: true }, undefined, bridge, requestId)
      }

      const parsed = body as z.infer<typeof TrackBodySchema>
      const normalizedEventName = normalizeFunnelEventName(parsed.eventName)
      const sanitizedProps = sanitizeGrowthEventProps(parsed.eventProps ?? {})
      const supabase = createRouteClient(request, bridge)
      const user = await getUserSafe(supabase)
      const actorUserId = user?.id ?? null

      try {
        await logProductEvent({
          userId: actorUserId,
          eventName: normalizedEventName,
          eventProps: sanitizedProps,
        })
      } catch (error) {
        logWarn({
          scope: 'analytics',
          message: 'analytics.track.failed',
          requestId,
          reason: 'product_analytics_insert_failed',
          eventName: normalizedEventName,
          userId: actorUserId,
          errorName: error instanceof Error ? error.name : 'unknown',
        })
        return ok({ ok: true }, undefined, bridge, requestId)
      }

      // Secondary: workspace-scoped growth event capture (queryable, sanitized).
      // Only capture for a bounded allowlist and never store nested objects.
      try {
        if (actorUserId && isGrowthEventName(normalizedEventName)) {
          await ensurePersonalWorkspace({ supabase, userId: actorUserId })
          const ws = await getCurrentWorkspace({ supabase, userId: actorUserId })
          if (ws) {
            const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: actorUserId })
            if (membership) {
              const rawDedupe = typeof (sanitizedProps as { dedupeKey?: unknown }).dedupeKey === 'string'
                ? (sanitizedProps as { dedupeKey: string }).dedupeKey
                : null
              const dedupeKey = rawDedupe && rawDedupe.trim().length > 0 ? rawDedupe.trim().slice(0, 128) : null
              await supabase.schema('api').from('growth_events').insert({
                workspace_id: ws.id,
                user_id: actorUserId,
                event_name: normalizedEventName,
                event_props: sanitizedProps,
                dedupe_key: dedupeKey,
                ...(parsed.eventAt ? { created_at: parsed.eventAt } : {}),
              })
            }
          }
        }
      } catch {
        // best-effort
      }
      return ok({ ok: true }, undefined, bridge, requestId)
    } catch (err) {
      logWarn({
        scope: 'analytics',
        message: 'analytics.track.failed',
        requestId,
        reason: 'track_route_unexpected_error',
        errorName: err instanceof Error ? err.name : 'unknown',
      })
      return ok({ ok: true }, undefined, bridge, requestId)
    }
  },
  { bodySchema: TrackBodySchema }
)

