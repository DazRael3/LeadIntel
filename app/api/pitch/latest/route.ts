import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { getLatestPitchForCompany } from '@/lib/services/pitches'

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

    const latest = await getLatestPitchForCompany(supabase, {
      userId,
      companyDomain: parsed.data.companyDomain ?? null,
      companyName: parsed.data.companyName ?? null,
    })

    return ok({ pitch: latest }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/pitch/latest', undefined, bridge, requestId)
  }
})

