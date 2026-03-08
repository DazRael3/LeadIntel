import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { getLatestPitchForCompany } from '@/lib/services/pitches'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { getPremiumGenerationCapabilities, getPremiumGenerationUsage, redactTextPreview } from '@/lib/billing/premium-generations'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  companyDomain: z.string().trim().min(1).optional(),
  companyName: z.string().trim().min(1).optional(),
})

export const GET = withApiGuard(async (request: NextRequest, { query, requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)

  try {
    // Auth is enforced by withApiGuard via lib/api/policy.ts (GET:/api/pitch/latest authRequired: true).
    // This guard is defensive for unexpected misconfiguration.
    if (!userId) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const parsed = QuerySchema.safeParse(query ?? {})
    if (!parsed.success) {
      return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
    }

    const user = await getUserSafe(supabase)
    if (!user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const [capabilities, usage] = await Promise.all([
      getPremiumGenerationCapabilities({ supabase, userId: user.id, sessionEmail: user.email ?? null }),
      getPremiumGenerationUsage({ supabase, userId: user.id }),
    ])

    const latest = await getLatestPitchForCompany(supabase, {
      userId: user.id,
      companyDomain: parsed.data.companyDomain ?? null,
      companyName: parsed.data.companyName ?? null,
    })

    if (!latest) return ok({ pitch: null, isBlurred: capabilities.blurPremiumSections, usage }, undefined, bridge, requestId)

    const pitchForViewer = capabilities.blurPremiumSections
      ? {
          ...latest,
          content: null,
          contentPreview: redactTextPreview(latest.content, 520),
          company: { ...latest.company, emailSequence: null, battleCard: null },
        }
      : { ...latest, contentPreview: null }

    return ok(
      {
        pitch: pitchForViewer,
        isBlurred: capabilities.blurPremiumSections,
        lockedSections: capabilities.blurPremiumSections ? (['pitch'] as const) : ([] as const),
        usage,
        upgradeRequired: capabilities.blurPremiumSections,
      },
      undefined,
      bridge,
      requestId
    )
  } catch (error) {
    return asHttpError(error, '/api/pitch/latest', undefined, bridge, requestId)
  }
})

