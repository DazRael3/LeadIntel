import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { UnlockLeadSchema } from '@/lib/api/schemas'
import { checkRateLimit, shouldBypassRateLimit, getRateLimitError } from '@/lib/api/ratelimit'
import { validateOrigin } from '@/lib/api/security'

/**
 * Unlock Lead API
 * Implements the 'One-Free-Lead' rule: Non-pro users can unlock 1 lead per 24 hours
 */
export async function POST(request: NextRequest) {
  const bridge = createCookieBridge()
  const route = '/api/unlock-lead'
  
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
        'WRITE'
      )
      
      if (rateLimitResult && !rateLimitResult.success) {
        return getRateLimitError(rateLimitResult, bridge)
      }
    }
    
    // Validate request body
    let body
    try {
      body = await validateBody(request, UnlockLeadSchema)
    } catch (error) {
      return validationError(error, bridge)
    }

    const { leadId } = body

    // Get current user via route client with request/response cookie bridging
    const supabase = createRouteClient(request, bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier, last_unlock_date')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return fail(ErrorCode.NOT_FOUND, 'User not found', undefined, undefined, bridge)
    }

    // Pro users have unlimited access
    if (userData.subscription_tier === 'pro') {
      return ok({
        unlocked: true,
        message: 'Lead unlocked (Pro user)',
      }, undefined, bridge)
    }

    // Free users: Check 24-hour rule
    const now = new Date()
    const lastUnlock = userData.last_unlock_date ? new Date(userData.last_unlock_date) : null
    
    if (lastUnlock) {
      const hoursSinceUnlock = (now.getTime() - lastUnlock.getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceUnlock < 24) {
        // Less than 24 hours since last unlock
        const hoursRemaining = Math.ceil(24 - hoursSinceUnlock)
        return fail(
          ErrorCode.FORBIDDEN,
          `You've already unlocked a lead today. Next unlock available in ${hoursRemaining} hours.`,
          {
            redirect: '/api/checkout',
            hoursRemaining,
          },
          undefined,
          bridge
        )
      }
    }

    // Allow unlock - update last_unlock_date
    const { error: updateError } = await supabase
      .from('users')
      .update({
        last_unlock_date: now.toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      return fail(
        ErrorCode.DATABASE_ERROR,
        'Failed to update unlock status',
        undefined,
        undefined,
        bridge
      )
    }

    return ok({
      unlocked: true,
      message: 'Lead unlocked successfully',
      nextUnlockAvailable: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/unlock-lead', undefined, bridge)
  }
}
