import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, createCookieBridge, asHttpError } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { buildActivationV2State } from '@/lib/growth/activation-v2'
import { getPremiumGenerationCapabilities, getPremiumGenerationUsage } from '@/lib/billing/premium-generations'

export const dynamic = 'force-dynamic'

type SettingsRow = {
  pricing_viewed_at?: string | null
  trust_viewed_at?: string | null
  scoring_viewed_at?: string | null
  templates_viewed_at?: string | null
}

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const supabase = createRouteClient(request, bridge)
    const user = await getUserSafe(supabase)
    if (!user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const [{ data: settingsRow }, { count: targetsCount }, { count: pitchesCount }, { count: reportsCount }, { count: briefsCount }, usage, capabilities] =
      await Promise.all([
        supabase
          .from('user_settings')
          .select('pricing_viewed_at, trust_viewed_at, scoring_viewed_at, templates_viewed_at')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('pitches').select('id', { count: 'exact', head: true }),
        supabase.from('user_reports').select('id', { count: 'exact', head: true }).eq('report_kind', 'competitive'),
        supabase.from('user_reports').select('id', { count: 'exact', head: true }).eq('report_kind', 'account_brief'),
        getPremiumGenerationUsage({ supabase, userId: user.id }),
        getPremiumGenerationCapabilities({ supabase, userId: user.id, sessionEmail: user.email ?? null }),
      ])

    const settings = (settingsRow ?? null) as unknown as SettingsRow | null
    const state = buildActivationV2State({
      targetsCount: typeof targetsCount === 'number' ? targetsCount : 0,
      pitchesCount: typeof pitchesCount === 'number' ? pitchesCount : 0,
      reportsCount: typeof reportsCount === 'number' ? reportsCount : 0,
      briefsCount: typeof briefsCount === 'number' ? briefsCount : 0,
      scoringViewed: Boolean(settings?.scoring_viewed_at),
      templatesViewed: Boolean(settings?.templates_viewed_at),
      pricingViewed: Boolean(settings?.pricing_viewed_at),
      trustViewed: Boolean(settings?.trust_viewed_at),
    })

    return ok(
      {
        activation: state,
        usage,
        capabilities: {
          tier: capabilities.tier,
          freeGenerationLabel: capabilities.freeGenerationLabel,
          freeGenerationHelper: capabilities.freeGenerationHelper,
          freeUsageScopeLabel: capabilities.freeUsageScopeLabel,
          lockedHelper: capabilities.lockedHelper,
        },
      },
      undefined,
      bridge,
      requestId
    )
  } catch (error) {
    return asHttpError(error, '/api/activation-v2', undefined, bridge, requestId)
  }
})

