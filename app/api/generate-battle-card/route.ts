import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { generateBattleCard } from '@/lib/ai-logic'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'

const GenerateBattleCardSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyUrl: z.string().url().optional(),
  triggerEvent: z.string().optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const { companyName, companyUrl, triggerEvent } = body as z.infer<typeof GenerateBattleCardSchema>

      // Pro gating
      const supabase = createRouteClient(request, bridge)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
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
          bridge,
          requestId
        )
      }

      const companyInfo = await fetchCompanyInfo(companyUrl || `https://${companyName.toLowerCase().replace(/\s+/g, '')}.com`)

      const battleCard = await generateBattleCard(
        companyName,
        triggerEvent || null,
        companyInfo,
        undefined
      )

      return ok(
        {
          techStack: battleCard.currentTech,
          weakness: battleCard.painPoint,
          whyBetter: battleCard.killerFeature,
        },
        undefined,
        bridge,
        requestId
      )
    } catch (error) {
      return asHttpError(error, '/api/generate-battle-card', userId, bridge, requestId)
    }
  },
  { bodySchema: GenerateBattleCardSchema }
)

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
