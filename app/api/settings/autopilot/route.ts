import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'

export const dynamic = 'force-dynamic'

const AutopilotSettingsSchema = z.object({
  enabled: z.boolean(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const supabase = createRouteClient(request, bridge)
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user || !userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const { enabled } = body as z.infer<typeof AutopilotSettingsSchema>

      const { data: updated, error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            autopilot_enabled: enabled,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('user_id, autopilot_enabled, updated_at')
        .single()

      if (error) {
        // Avoid leaking DB details
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to update autopilot settings', undefined, undefined, bridge, requestId)
      }

      return ok({ settings: updated }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/settings/autopilot', userId, bridge, requestId)
    }
  },
  { bodySchema: AutopilotSettingsSchema }
)

