import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { UnlockLeadSchema } from '@/lib/api/schemas'
import { withApiGuard } from '@/lib/api/guard'
import { isPro as isProPlan } from '@/lib/billing/plan'

/**
 * Unlock Lead API
 * Implements the 'One-Free-Lead' rule: Non-pro users can unlock 1 lead per 24 hours
 */
export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {

    const { leadId } = body as { leadId: string }

    // Get current user via route client with request/response cookie bridging
    const supabase = createRouteClient(request, bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier, last_unlock_date')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return fail(ErrorCode.NOT_FOUND, 'User not found', undefined, undefined, bridge, requestId)
    }

    // Pro users (and app-trial users, if enabled) have unlimited access.
    if (await isProPlan(supabase, user.id)) {
      return ok({
        unlocked: true,
        message: 'Lead unlocked (Pro user)',
      }, undefined, bridge, requestId)
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
            // Centralize upgrade flow on /pricing (checkout is initiated via POST /api/checkout there).
            redirect: '/pricing',
            hoursRemaining,
          },
          undefined,
          bridge,
          requestId
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
        bridge,
        requestId
      )
    }

    return ok({
      unlocked: true,
      message: 'Lead unlocked successfully',
      nextUnlockAvailable: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/unlock-lead', undefined, bridge, requestId)
    }
  },
  { bodySchema: UnlockLeadSchema }
)
