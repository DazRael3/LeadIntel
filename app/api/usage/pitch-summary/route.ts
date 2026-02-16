import { NextRequest } from 'next/server'
import { z } from 'zod'

import { withApiGuard } from '@/lib/api/guard'
import { ok, asHttpError, createCookieBridge, fail, ErrorCode } from '@/lib/api/http'
import { logger } from '@/lib/observability/logger'
import { getStarterLeadCountFromDb, getStarterPitchCapSummary } from '@/lib/billing/usage'
import { STARTER_PITCH_CAP_LIMIT } from '@/lib/billing/constants'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveTierFromDb } from '@/lib/billing/resolve-tier'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({})

export const GET = withApiGuard(
  async (request: NextRequest, { requestId, userId }) => {
    const bridge = createCookieBridge()
    try {
      // Auth is enforced by withApiGuard via lib/api/policy.ts (GET:/api/usage/pitch-summary authRequired: true).
      // This guard is defensive for unexpected misconfiguration.
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      // Resolve tier from canonical billing sources (service role, api schema).
      const admin = createSupabaseAdminClient({ schema: 'api' })
      const resolved = await resolveTierFromDb(admin as any, userId)
      const tier = resolved.tier

      let pitchesUsed = 0
      let pitchesLimit: number | null = null
      if (tier === 'starter') {
        const leadCount = await getStarterLeadCountFromDb(userId)
        const cap = await getStarterPitchCapSummary({ userId })
        const used = Math.max(Math.max(leadCount, 0), Math.max(cap.used, 0))
        // Best-effort: clamp to the starter credit cap.
        pitchesUsed = Math.min(used, STARTER_PITCH_CAP_LIMIT)
        pitchesLimit = STARTER_PITCH_CAP_LIMIT
      } else {
        pitchesUsed = 0
        pitchesLimit = null
      }

      logger.info({
        level: 'info',
        scope: 'usage',
        message: 'pitch.summary',
        userId,
        tier,
        pitchesUsed,
        pitchesLimit,
      })

      // Additional log line (keep existing one above intact).
      logger.info({
        level: 'info',
        scope: 'usage',
        message: 'pitch_summary',
        userId,
        tier,
        pitchesUsed,
        pitchesLimit,
      })

      return ok({ tier, pitchesUsed, pitchesLimit }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/usage/pitch-summary', undefined, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

