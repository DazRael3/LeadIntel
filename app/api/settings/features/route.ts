import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'

export const dynamic = 'force-dynamic'

const FeatureSettingsSchema = z.object({
  clearbit_enrichment: z.boolean().optional(),
  zapier_push: z.boolean().optional(),
})

type FeatureKey = keyof z.infer<typeof FeatureSettingsSchema>

const FEATURE_KEYS: FeatureKey[] = ['clearbit_enrichment', 'zapier_push']

export const POST = withApiGuard(
  async (request: NextRequest, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const supabase = createRouteClient(request, bridge)
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user || !userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const input = body as z.infer<typeof FeatureSettingsSchema>

      const rows = FEATURE_KEYS.flatMap((feature) => {
        const enabled = input[feature]
        if (typeof enabled !== 'boolean') return []
        return [{ user_id: user.id, feature, enabled }]
      })

      if (rows.length === 0) {
        return ok({ updated: [] }, undefined, bridge, requestId)
      }

      const { data: updated, error } = await supabase
        .from('feature_flags')
        .upsert(rows, { onConflict: 'user_id,feature' })
        .select('feature, enabled, updated_at')

      if (error) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to update feature flags', undefined, undefined, bridge, requestId)
      }

      return ok({ updated: updated || [] }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/settings/features', userId, bridge, requestId)
    }
  },
  { bodySchema: FeatureSettingsSchema }
)

