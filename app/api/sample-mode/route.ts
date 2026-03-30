import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { getUserTierForGating } from '@/lib/team/gating'
import { hasCapability } from '@/lib/billing/capabilities'
import { purgeSampleData, seedSampleModeData } from '@/lib/sample-mode/seed'

export const dynamic = 'force-dynamic'

const PostSchema = z.object({
  action: z.enum(['enable', 'reset', 'disable']),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const supabase = createRouteClient(request, bridge)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    const enabledByTier = hasCapability(tier, 'sample_workspace')
    if (!enabledByTier) {
      return ok({ enabledByTier: false, enabled: false, seededAt: null, seedVersion: null }, undefined, bridge, requestId)
    }

    const { data } = await supabase
      .schema('api')
      .from('user_settings')
      .select('sample_mode_enabled, sample_seeded_at, sample_seed_version')
      .eq('user_id', user.id)
      .maybeSingle()

    const row = (data ?? null) as {
      sample_mode_enabled?: boolean | null
      sample_seeded_at?: string | null
      sample_seed_version?: number | null
    } | null

    return ok(
      {
        enabledByTier: true,
        enabled: Boolean(row?.sample_mode_enabled),
        seededAt: row?.sample_seeded_at ?? null,
        seedVersion: typeof row?.sample_seed_version === 'number' ? row.sample_seed_version : null,
      },
      undefined,
      bridge,
      requestId
    )
  } catch (e) {
    return asHttpError(e, '/api/sample-mode', userId, bridge, requestId)
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
      const enabledByTier = hasCapability(tier, 'sample_workspace')
      if (!enabledByTier) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', { reason: 'sample_workspace_not_enabled' }, undefined, bridge, requestId)
      }

      const parsed = PostSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      if (parsed.data.action === 'disable') {
        await purgeSampleData({ supabase, userId: user.id })
        await supabase
          .schema('api')
          .from('user_settings')
          .upsert(
            { user_id: user.id, sample_mode_enabled: false, updated_at: new Date().toISOString() } as never,
            { onConflict: 'user_id' }
          )
          .catch(() => undefined)
        return ok({ ok: true, action: 'disable' as const }, undefined, bridge, requestId)
      }

      if (parsed.data.action === 'reset') {
        await purgeSampleData({ supabase, userId: user.id })
      }

      const seeded = await seedSampleModeData({ supabase, userId: user.id })
      if (!seeded.ok) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to seed sample data', { reason: seeded.reason }, undefined, bridge, requestId)
      }

      return ok({ ok: true, action: parsed.data.action, seededCounts: seeded.seededCounts }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/sample-mode', userId, bridge, requestId)
    }
  },
  { bodySchema: PostSchema }
)

