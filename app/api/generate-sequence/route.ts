import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { generateEmailSequence } from '@/lib/ai-logic'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { z } from 'zod'
import { checkRateLimit, shouldBypassRateLimit, getRateLimitError } from '@/lib/api/ratelimit'
import { validateOrigin } from '@/lib/api/security'

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
  const bridge = createCookieBridge()
  const route = '/api/generate-sequence'
  
  try {
    // Validate origin for state-changing requests
    const originError = validateOrigin(request, route)
    if (originError) {
      return originError
    }
    
    // Check rate limit bypass
    if (!shouldBypassRateLimit(request, route)) {
      // Get user for rate limiting
      const supabase = createRouteClient(request, bridge)
      const { data: { user } } = await supabase.auth.getUser()
      
      // Check rate limit
      const rateLimitResult = await checkRateLimit(
        request,
        user?.id || null,
        route,
        'AI_GENERATION'
      )
      
      if (rateLimitResult && !rateLimitResult.success) {
        return getRateLimitError(rateLimitResult, bridge)
      }
    }
    
    // Validate request body (max 2MB for company info + settings)
    let body
    try {
      body = await validateBody(request, GenerateSequenceSchema, { maxBytes: 2 * 1024 * 1024 })
    } catch (error) {
      return validationError(error, bridge)
    }

    const { companyName, triggerEvent, ceoName, companyInfo, userSettings } = body

    // Server-side Pro gating: Check subscription tier before any AI generation
    const supabase = createRouteClient(request, bridge)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    const { data: userData } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    if (userData?.subscription_tier !== 'pro') {
      return fail(
        ErrorCode.FORBIDDEN,
        'Pro subscription required for Email Sequence generation',
        undefined,
        undefined,
        bridge
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

    return ok({ sequence }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/generate-sequence', undefined, bridge)
  }
}
