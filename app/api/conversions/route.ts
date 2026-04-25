import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'

export const dynamic = 'force-dynamic'

const ConversionBodySchema = z.object({
  leadId: z.string().uuid(),
  converted: z.boolean(),
})

type ConversionRow = {
  id: string
  lead_id: string | null
  event_type: string
  occurred_at: string
}

function conversionEventType(converted: boolean): 'lead_converted_yes' | 'lead_converted_no' {
  return converted ? 'lead_converted_yes' : 'lead_converted_no'
}

export const GET = withApiGuard(
  async (request: NextRequest, { requestId, userId, query }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const leadIdRaw = typeof (query as { leadId?: unknown } | undefined)?.leadId === 'string'
        ? (query as { leadId: string }).leadId
        : null
      const leadId = leadIdRaw && z.string().uuid().safeParse(leadIdRaw).success ? leadIdRaw : null
      if (!leadId) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Valid leadId query parameter required.', undefined, { status: 400 }, bridge, requestId)
      }

      const { data, error } = await supabase
        .schema('api')
        .from('conversions')
        .select('id, lead_id, event_type, occurred_at')
        .eq('user_id', user.id)
        .eq('lead_id', leadId)
        .in('event_type', ['lead_converted_yes', 'lead_converted_no'])
        .order('occurred_at', { ascending: false })
        .limit(1)

      if (error) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to load conversion feedback.', undefined, undefined, bridge, requestId)
      }

      const latest = ((data ?? [])[0] ?? null) as ConversionRow | null
      return ok(
        {
          conversion: latest
            ? {
                converted: latest.event_type === 'lead_converted_yes',
                occurredAt: latest.occurred_at,
              }
            : null,
        },
        undefined,
        bridge,
        requestId
      )
    } catch (error) {
      return asHttpError(error, '/api/conversions', userId ?? undefined, bridge, requestId)
    }
  },
  { querySchema: z.object({ leadId: z.string().uuid() }) }
)

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const payload = body as z.infer<typeof ConversionBodySchema>
      const eventType = conversionEventType(payload.converted)
      const nowIso = new Date().toISOString()

      const { error } = await supabase
        .schema('api')
        .from('conversions')
        .insert({
          user_id: user.id,
          lead_id: payload.leadId,
          event_type: eventType,
          occurred_at: nowIso,
          source: 'lead_detail_feedback',
          metadata: { surface: 'lead_detail', converted: payload.converted },
        })
      if (error) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to store conversion feedback.', undefined, undefined, bridge, requestId)
      }

      return ok(
        {
          converted: payload.converted,
          occurredAt: nowIso,
        },
        { status: 201 },
        bridge,
        requestId
      )
    } catch (error) {
      return asHttpError(error, '/api/conversions', userId ?? undefined, bridge, requestId)
    }
  },
  { bodySchema: ConversionBodySchema }
)
