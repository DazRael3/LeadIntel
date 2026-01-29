import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { generatePitch, generateBattleCard, generateEmailSequence } from '@/lib/ai-logic'
import { queryWithSchemaFallback } from '@/lib/supabase/schema-client'
import { getDbSchema } from '@/lib/supabase/schema'
import { getServerEnv } from '@/lib/env'
import { ok, asHttpError, createCookieBridge } from '@/lib/api/http'
import { CompanyUrlSchema, GeneratePitchOptionsSchema } from '@/lib/api/schemas'
import { withApiGuard } from '@/lib/api/guard'
import { isE2E, isTestEnv } from '@/lib/runtimeFlags'
import { isPro as isProPlan } from '@/lib/billing/plan'
import { ingestRealTriggerEvents, seedDemoTriggerEventsIfEmpty, hasAnyTriggerEvents, getLatestTriggerEvent } from '@/lib/services/triggerEvents'

export const dynamic = "force-dynamic";

/**
 * Check if a string looks like a URL or domain
 * e.g., "lego.com", "https://lego.com", "www.lego.com"
 */
function looksLikeUrl(input: string): boolean {
  // If it starts with http:// or https://, it's definitely a URL
  if (/^https?:\/\//i.test(input)) return true
  
  // Check if it looks like a domain (has a dot followed by a TLD-like pattern)
  // e.g., "lego.com", "company.co.uk", "example.io"
  const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/
  const cleaned = input.replace(/^www\./i, '').split('/')[0]
  return domainPattern.test(cleaned)
}

/**
 * Extract a readable topic name from the input
 * For URLs, extracts the domain name. For free-form text, returns as-is (capitalized)
 */
function extractTopicName(input: string): string {
  if (looksLikeUrl(input)) {
    return extractCompanyName(input)
  }
  // For free-form text, capitalize first letter of each word
  return input
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .substring(0, 100) // Limit length for display
}

/**
 * Generate context info for the AI based on input type
 */
function generateContextInfo(input: string, isUrlLike: boolean): string {
  if (isUrlLike) {
    return `Company website: ${input}. This is a B2B company that could benefit from our solutions.`
  }
  // For free-form topics, provide context differently
  return `Topic/Company: ${input}. Generate a pitch based on this topic or company name. This is likely a B2B prospect that could benefit from our solutions.`
}

/**
 * Safely extract domain from input, returns null for non-URL inputs
 */
function safeExtractDomain(input: string): string | null {
  if (!looksLikeUrl(input)) return null
  try {
    const url = input.startsWith('http') ? new URL(input) : new URL('https://' + input)
    return url.hostname.replace(/^www\./, '')
  } catch {
    // If parsing fails, try a simpler extraction
    const cleaned = input.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]
    return cleaned.includes('.') ? cleaned : null
  }
}

export const POST = withApiGuard(
  async (request, { body, userId, requestId }) => {
    const env = getServerEnv()
    const isDev = env.NODE_ENV !== 'production'
    const bridge = createCookieBridge()
    
    if (!userId) {
      return asHttpError(new Error('Authentication required'), '/api/generate-pitch', undefined, bridge, requestId)
    }

    const data = body as { companyUrl: string; options?: unknown }
    const { companyUrl } = data
    
    // Normalize input
    const input = companyUrl.trim()
    if (!input) {
      return asHttpError(
        new Error('Please enter a company name, URL, or topic for your pitch'),
        '/api/generate-pitch',
        undefined,
        bridge,
        requestId
      )
    }

    const isUrlLike = looksLikeUrl(input)
    const topicName = extractTopicName(input)
    const domain = safeExtractDomain(input)

    if (isDev) {
      console.log('[generate-pitch] Start:', { userId, input, isUrlLike, topicName, domain })
    }

    const supabase = createRouteClient(request, bridge)
    
    const isPro = await isProPlan(supabase, userId)

    // Get user settings for personalization
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('what_you_sell, ideal_customer')
      .eq('user_id', userId)
      .maybeSingle()

    // Fetch company info based on input type
    let companyInfo: string
    if (isE2E() || isTestEnv()) {
      companyInfo = generateContextInfo(input, isUrlLike)
    } else if (isUrlLike) {
      // For URL-like input, use the full company info fetching
      companyInfo = await fetchCompanyInfo(input)
    } else {
      // For free-form topics, generate a simpler context
      companyInfo = generateContextInfo(input, false)
    }

    // Generate pitch using AI
    const pitch = await generatePitch(
      topicName,
      null, // triggerEvent - not available in this context
      null, // ceoName - not available
      companyInfo,
      {
        whatYouSell: userSettings?.what_you_sell || '',
        idealCustomer: userSettings?.ideal_customer || '',
      }
    )

    // Generate battle card and email sequence for Pro users
    let battleCard = null
    let emailSequence = null
    if (isPro) {
      battleCard = await generateBattleCard(
        topicName,
        null, // triggerEvent
        companyInfo,
        {
          whatYouSell: userSettings?.what_you_sell || '',
          idealCustomer: userSettings?.ideal_customer || '',
        }
      )
      emailSequence = await generateEmailSequence(
        topicName,
        null, // triggerEvent
        null, // ceoName
        companyInfo,
        {
          whatYouSell: userSettings?.what_you_sell || '',
          idealCustomer: userSettings?.ideal_customer || '',
        }
      )
    }

    // Get database schema
    const dbSchema = getDbSchema()
    const dbSchemaUsed = dbSchema.primary || 'api'
    const dbFallbackUsed = false

    // Save lead to database (only if we have a domain for URL-like inputs)
    let savedLead: { data: unknown; error: unknown } = { data: null, error: null }
    if (domain) {
      savedLead = await queryWithSchemaFallback(
        request,
        bridge,
        async (client) => {
          const result = await client
            .from('leads')
            .upsert({
              user_id: userId,
              company_name: topicName,
              company_domain: domain,
              company_url: input,
              ai_personalized_pitch: pitch,
              battle_card: battleCard,
              email_sequence: emailSequence,
            }, {
              onConflict: 'user_id,company_domain'
            })
            .select()
            .single()
          return { data: result.data, error: result.error }
        }
      )
    }

    const leadId = (savedLead.data as { id?: string } | null)?.id ?? null
    const correlationId = `generate-pitch:${new Date().toISOString()}:${userId}`
    const triggerInput = {
      userId,
      leadId: typeof leadId === 'string' ? leadId : null,
      companyName: topicName || null,
      companyDomain: domain,
      correlationId,
    }

    // Production-style Trigger Events ingestion:
    // 1) Ingest real events first (best effort, may be no-op if provider is none)
    await ingestRealTriggerEvents(triggerInput)

    // 2) Optionally seed demo events if still empty
    // Note: Keep this callable in tests; service is mocked there.
    const demoEnabled = env.ENABLE_DEMO_TRIGGER_EVENTS !== '0' && env.ENABLE_DEMO_TRIGGER_EVENTS !== 'false'
    if (demoEnabled) {
      await seedDemoTriggerEventsIfEmpty(triggerInput)
    }

    const hasTriggerEvent = await hasAnyTriggerEvents(triggerInput)
    const latestTriggerEvent = await getLatestTriggerEvent(triggerInput)

    const response = {
      pitch,
      battleCard,
      emailSequence,
      lead: savedLead.data,
      triggerEvent: latestTriggerEvent,
      hasTriggerEvent,
    }

    if (isDev) {
      console.log('[generate-pitch] Success:', { 
        hasPitch: !!pitch, 
        hasLead: !!savedLead.data, 
        hasTriggerEvent,
        schema: dbSchemaUsed,
        fallbackUsed: dbFallbackUsed,
      })
    }

    const successResponse = ok(response, undefined, bridge, requestId)
    return successResponse
  },
  {
    bodySchema: CompanyUrlSchema.extend({
      options: GeneratePitchOptionsSchema.omit({ companyUrl: true }).optional(),
    }),
  }
)

// Helper functions (unchanged)
async function fetchCompanyInfo(url: string): Promise<string> {
  try {
    let domain: string
    try {
      const u = url.startsWith('http') ? new URL(url) : new URL('https://' + url)
      domain = u.hostname.replace(/^www\./, '')
    } catch {
      domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    }
    
    const companyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
    
    let companyInfo = ''
    const env = getServerEnv()
    const clearbitKey = env.CLEARBIT_API_KEY
    if (clearbitKey) {
      try {
        const clearbitResponse = await fetch(`https://company.clearbit.com/v2/companies/find?domain=${domain}`, {
          headers: {
            'Authorization': `Bearer ${clearbitKey}`,
          },
        })
        if (clearbitResponse.ok) {
          const clearbitData = await clearbitResponse.json()
          companyInfo = `Company: ${clearbitData.name || companyName}. Industry: ${clearbitData.category?.industry || 'Unknown'}. Description: ${clearbitData.description || 'No description available'}. `
        }
      } catch (error) {
        // Non-fatal error, continue
      }
    }
    
    let recentNews = ''
    const newsApiKey = env.NEWS_API_KEY
    if (newsApiKey) {
      try {
        const newsResponse = await fetch(
          `https://newsapi.org/v2/everything?q="${companyName}" OR "${domain}"&sortBy=publishedAt&pageSize=5&language=en&apiKey=${newsApiKey}`
        )
        if (newsResponse.ok) {
          const newsData = await newsResponse.json()
          if (newsData.articles && newsData.articles.length > 0) {
            const articles = newsData.articles.slice(0, 3).map((article: { title: string; publishedAt: string }) => 
              `${article.title} (${new Date(article.publishedAt).toLocaleDateString()})`
            ).join('; ')
            recentNews = `Recent news: ${articles}. `
          }
        }
      } catch (error) {
        // Non-fatal error, continue
      }
    } else {
      try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(companyName)}&hl=en-US&gl=US&ceid=US:en`
        const rssResponse = await fetch(rssUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        if (rssResponse.ok) {
          const rssText = await rssResponse.text()
          const titleMatches = rssText.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)
          if (titleMatches && titleMatches.length > 1) {
            const headlines = titleMatches.slice(1, 4).map(match => 
              match.replace(/<title><!\[CDATA\[(.*?)\]\]><\/title>/, '$1')
            ).join('; ')
            recentNews = `Recent news: ${headlines}. `
          }
        }
      } catch (error) {
        // Non-fatal error, continue
      }
    }
    
    let websiteInfo = ''
    try {
      const websiteResponse = await fetch(url.startsWith('http') ? url : `https://${url}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LeadIntel/1.0)',
        },
        signal: AbortSignal.timeout(5000),
      })
      if (websiteResponse.ok) {
        const html = await websiteResponse.text()
        const titleMatch = html.match(/<title>(.*?)<\/title>/i)
        const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i)
        if (titleMatch) websiteInfo += `Website title: ${titleMatch[1]}. `
        if (metaDescMatch) websiteInfo += `Description: ${metaDescMatch[1]}. `
      }
    } catch (error) {
      // Non-fatal error, continue
    }
    
    const combinedInfo = `${companyInfo}${recentNews}${websiteInfo}Company website: ${url}. This is a B2B company that could benefit from our solutions.`
    return combinedInfo.trim() || `Company website: ${url}. This is a B2B company that could benefit from our solutions.`
  } catch (error) {
    return `Company website: ${url}. This is a B2B company that could benefit from our solutions.`
  }
}

function extractCompanyName(url: string): string {
  try {
    const u = url.startsWith('http') ? new URL(url) : new URL('https://' + url)
    const domain = u.hostname.replace(/^www\./, '')
    return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
  } catch {
    return 'Company'
  }
}
