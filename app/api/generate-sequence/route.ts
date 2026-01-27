import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { generateEmailSequence } from '@/lib/ai-logic'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { isPro as isProPlan } from '@/lib/billing/plan'

/**
 * Generate 3-Part Email Sequence API
 * Enterprise Intelligence feature - Pro users only
 */

const GenerateSequenceSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  triggerEvent: z.string().min(1, 'Trigger event is required'),
  ceoName: z.string().optional(),
  companyInfo: z.string().optional(),
  userSettings: z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  return POST_GUARDED(request)
}

const POST_GUARDED = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const { companyName, triggerEvent, ceoName, companyInfo, userSettings } = body as z.infer<typeof GenerateSequenceSchema>

    // Server-side Pro gating: Check subscription tier before any AI generation
    const supabase = createRouteClient(request, bridge)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    if (!(await isProPlan(supabase, user.id))) {
      return fail(
        ErrorCode.FORBIDDEN,
        'Pro subscription required for Email Sequence generation',
        undefined,
        undefined,
        bridge,
        requestId
      )
    }

    // Generate 3-part sequence
    const sequence = await generateEmailSequence(
      companyName,
      triggerEvent,
      ceoName || null,
      companyInfo || null,
      userSettings
    )

    return ok({ sequence }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/generate-sequence', undefined, bridge, requestId)
    }
  },
  { bodySchema: GenerateSequenceSchema }
)
