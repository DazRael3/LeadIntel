import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { generateBattleCard } from '@/lib/ai-logic'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { z } from 'zod'
import { checkRateLimit, shouldBypassRateLimit, getRateLimitError } from '@/lib/api/ratelimit'
import { validateOrigin } from '@/lib/api/security'

const GenerateBattleCardSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyUrl: z.string().url().optional(),
  triggerEvent: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const bridge = createCookieBridge()
  const route = '/api/generate-battle-card'
  
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
    
    // Validate request body
    let body
    try {
      body = await validateBody(request, GenerateBattleCardSchema)
    } catch (error) {
      return validationError(error, bridge)
    }

    const { companyName, companyUrl, triggerEvent } = body

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
        'Pro subscription required for Battle Card generation',
        undefined,
        undefined,
        bridge
      )
    }

    // Fetch company website info (placeholder - in production use scraping)
    const companyInfo = await fetchCompanyInfo(companyUrl || `https://${companyName.toLowerCase().replace(/\s+/g, '')}.com`)

    // Generate battle card using centralized logic
    const battleCard = await generateBattleCard(
      companyName,
      triggerEvent || null, // Convert undefined to null
      companyInfo,
      undefined // userSettings - could be passed if available
    )

    // Transform to expected format
    return ok({
      techStack: battleCard.currentTech,
      weakness: battleCard.painPoint,
      whyBetter: battleCard.killerFeature,
    }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/generate-battle-card', undefined, bridge)
  }
}

async function fetchCompanyInfo(url: string): Promise<string> {
  try {
    // Fetch company information from website
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LeadIntel/1.0)',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })
    
    if (!response.ok) {
      return `Company website: ${url}. This is a B2B company that recently experienced a trigger event.`
    }
    
    const html = await response.text()
    // Extract basic company info from HTML (simplified - in production, use proper parsing)
    const titleMatch = html.match(/<title>(.*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1] : ''
    
    return `Company website: ${url}. ${title ? `Company: ${title}. ` : ''}This is a B2B company that recently experienced a trigger event.`
  } catch (error) {
    // Fallback to basic info if fetch fails
    return `Company website: ${url}. This is a B2B company that recently experienced a trigger event.`
  }
}
