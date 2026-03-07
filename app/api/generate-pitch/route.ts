import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createRouteClient } from '@/lib/supabase/route'
import { generatePitch, generateBattleCard, generateEmailSequence } from '@/lib/ai-logic'
import { queryWithSchemaFallback } from '@/lib/supabase/schema-client'
import { getDbSchema } from '@/lib/supabase/schema'
import { getServerEnv } from '@/lib/env'
import { ok, asHttpError, createCookieBridge, fail } from '@/lib/api/http'
import { CompanyUrlSchema, GeneratePitchOptionsSchema } from '@/lib/api/schemas'
import { withApiGuard } from '@/lib/api/guard'
import { isE2E, isTestEnv } from '@/lib/runtimeFlags'
import { isPro as isProPlan } from '@/lib/billing/plan'
import { getPlanDetails } from '@/lib/billing/plan'
import { ingestRealTriggerEvents, seedDemoTriggerEventsIfEmpty, hasAnyTriggerEvents, getLatestTriggerEvent } from '@/lib/services/triggerEvents'
import { serverEnv } from '@/lib/env'
import { logProductEvent } from '@/lib/services/analytics'
import { getCompositeTriggerEvents } from '@/lib/services/trigger-events/engine'
import { getPitchTemplate, type PitchTemplateId } from '@/lib/ai/pitch-templates'
import { logInfo } from '@/lib/observability/logger'
import { checkStarterPitchUsage, getStarterLeadCountFromDb, getStarterPitchCapSummary, recordStarterPitchCapUsage } from '@/lib/billing/usage'
import { STARTER_PITCH_CAP_LIMIT } from '@/lib/billing/constants'
import { makeNameCompanyKey } from '@/lib/company-key'
import { ensurePersonalWorkspace, getCurrentWorkspace } from '@/lib/team/workspace'
import { enqueueWebhookEvent } from '@/lib/integrations/webhooks'
import { randomUUID } from 'crypto'

export const dynamic = "force-dynamic";

type Tier = 'starter' | 'closer'

function isActiveStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing'
}

async function resolveTierForUser(supabase: unknown, userId: string): Promise<Tier> {
  try {
    // Use schema('api') when available; fall back to default client otherwise.
    const client = (supabase as any).schema ? (supabase as any).schema('api') : (supabase as any)
    const { data: subRow } = await client
      .from('subscriptions')
      .select('status, stripe_price_id, price_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const status = (subRow as { status?: string | null } | null)?.status ?? null
    if (!isActiveStatus(status)) return 'starter'
    // Product spec: only Starter and Closer are exposed.
    // Legacy note: any historical "team" price IDs are treated as Closer.
    return 'closer'
  } catch {
    // Safe default: treat as Starter for usage cap (cap check itself is fail-open if Redis missing).
    return 'starter'
  }
}

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

    const data = body as { companyUrl: string; options?: unknown; templateId?: unknown }
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
    
    let isPro = false
    try {
      isPro = await isProPlan(supabase, userId)
    } catch {
      // Fail closed to Starter for abuse prevention (cap check still fail-open if Redis isn't configured).
      isPro = false
    }

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

    const correlationId = `generate-pitch:${requestId ?? new Date().toISOString()}:${userId}`
    const templateId = (typeof data.templateId === 'string' ? (data.templateId as PitchTemplateId) : undefined) ?? 'default'
    const template = getPitchTemplate(templateId)
    logInfo({
      scope: 'pitch',
      message: 'generate.start',
      userId,
      correlationId,
      templateId: template.id,
      hasDomain: Boolean(domain),
    })
    // Fetch top scored trigger events for "Why now?" enrichment (fail-open).
    let whyNowBullets: string[] = []
    try {
      const scored = await getCompositeTriggerEvents({
        companyName: topicName,
        companyDomain: domain,
        userId,
        correlationId,
      })
      whyNowBullets = scored
        .filter((e) => e.score >= 60)
        .slice(0, 5)
        .map((e) => `${e.publishedAt.slice(0, 10)}: ${e.title} [${e.category}, score=${e.score}]`)
    } catch {
      // best-effort enrichment only
      whyNowBullets = []
    }

    // Tier gating rules (explicit):
    // - starter: enforce daily usage cap
    // - paid tiers + House Closer override: no Starter caps
    //
    // IMPORTANT: plan detection (`isProPlan`) already includes HOUSE_CLOSER_EMAILS and
    // `api.users.subscription_tier` overrides. Starter caps must respect that.
    const tier = isPro ? 'closer' : await resolveTierForUser(supabase, userId)
    if (tier === 'starter') {
      // Starter hard cap: 3 total leads/pitches. DB-backed so it remains consistent across restarts.
      const leadCount = await getStarterLeadCountFromDb(userId)
      // Fallback: if DB counting is unavailable in local/dev (e.g. schema not exposed),
      // use the in-memory/Redis cap counter so the Starter cap UX/enforcement still works.
      const cap = await getStarterPitchCapSummary({ userId })
      const used = Math.max(leadCount, cap.used)
      if (used >= STARTER_PITCH_CAP_LIMIT) {
        logInfo({
          scope: 'starter_cap',
          message: 'hard_cap_reached',
          userId,
          leadCount,
          capUsed: cap.used,
          limit: STARTER_PITCH_CAP_LIMIT,
        })
        return fail(
          'FREE_PLAN_LIMIT_REACHED',
          `You’ve used your ${STARTER_PITCH_CAP_LIMIT} free pitches on the Starter plan. Upgrade to Closer to unlock unlimited pitches.`,
          { limit: STARTER_PITCH_CAP_LIMIT, window: 'lifetime' },
          {
            status: 429,
            headers: {
              'x-upgrade-plan': 'closer',
              'x-free-plan-limit': String(STARTER_PITCH_CAP_LIMIT),
            },
          },
          bridge,
          requestId
        )
      }
      const usage = await checkStarterPitchUsage({ userId, planId: 'starter', correlationId })
      if (!usage.ok) {
        const res = fail(
          'FREE_PLAN_LIMIT_REACHED',
          `You’ve reached today’s free limit for the Starter plan. Upgrade to Closer for higher limits.`,
          { limit: usage.limit, window: '1 day' },
          {
            status: 429,
            headers: {
              'x-upgrade-plan': 'closer',
              'x-free-plan-limit': String(usage.limit),
            },
          },
          bridge,
          requestId
        )
        return res
      }
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
      },
      whyNowBullets.length > 0 ? { bullets: whyNowBullets } : undefined
      ,
      template.id
    )

    // Generate battle card and email sequence (best-effort).
    // These outputs are visually gated in the UI for Starter users, but we still compute them here
    // so Starter users can preview blurred content and upgrade.
    let battleCard: unknown | null = null
    let emailSequence: unknown | null = null
    try {
      const [bc, seq] = await Promise.allSettled([
        generateBattleCard(topicName, null, companyInfo, {
          whatYouSell: userSettings?.what_you_sell || '',
          idealCustomer: userSettings?.ideal_customer || '',
        }),
        generateEmailSequence(topicName, null, null, companyInfo, {
          whatYouSell: userSettings?.what_you_sell || '',
          idealCustomer: userSettings?.ideal_customer || '',
        }),
      ])
      if (bc.status === 'fulfilled') battleCard = bc.value
      if (seq.status === 'fulfilled') emailSequence = seq.value
    } catch {
      // Best-effort only; do not block pitch generation.
      battleCard = null
      emailSequence = null
    }

    // Get database schema
    const dbSchema = getDbSchema()
    const dbSchemaUsed = dbSchema.primary || 'api'
    const dbFallbackUsed = false

    // Save lead to database.
    // Note: pitches.lead_id is NOT NULL, so we always ensure there is a lead row.
    // IMPORTANT: `api.leads.company_domain` is NOT NULL (default '' in prod schema). For name-only inputs,
    // we store a deterministic name-key so the unique constraint (user_id, company_domain) remains usable.
    let savedLead: { data: unknown; error: unknown } = { data: null, error: null }
    const leadCompanyDomain = domain ? domain : makeNameCompanyKey(topicName || input)
    savedLead = await queryWithSchemaFallback(request, bridge, async (client) => {
      if (domain) {
        const result = await client
          .from('leads')
          .upsert(
            {
              user_id: userId,
              company_name: topicName,
              company_domain: leadCompanyDomain,
              company_url: input,
              ai_personalized_pitch: pitch,
              battle_card: battleCard,
              email_sequence: emailSequence,
            },
            {
              onConflict: 'user_id,company_domain',
            }
          )
          .select()
          .single()
        return { data: result.data, error: result.error }
      }

      const result = await client
        .from('leads')
        .insert({
          user_id: userId,
          company_name: topicName,
          company_domain: leadCompanyDomain,
          company_url: input,
          ai_personalized_pitch: pitch,
          battle_card: battleCard,
          email_sequence: emailSequence,
        })
        .select()
        .single()
      return { data: result.data, error: result.error }
    })

    const leadId = (savedLead.data as { id?: string } | null)?.id ?? null
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
    // Demo trigger events are a dev/test convenience and should be OFF by default in production.
    const demoEnabled = isE2E() || isTestEnv()
      ? env.ENABLE_DEMO_TRIGGER_EVENTS !== '0' && env.ENABLE_DEMO_TRIGGER_EVENTS !== 'false'
      : env.ENABLE_DEMO_TRIGGER_EVENTS === '1' || env.ENABLE_DEMO_TRIGGER_EVENTS === 'true'
    if (demoEnabled) {
      await seedDemoTriggerEventsIfEmpty(triggerInput)
    }

    const hasTriggerEvent = await hasAnyTriggerEvents(triggerInput)
    const latestTriggerEvent = await getLatestTriggerEvent(triggerInput)

    // Persist pitch history row (best-effort; do not fail the request if this write fails).
    const warnings: string[] = []
    if (typeof leadId === 'string' && leadId.length > 0) {
      try {
        const persisted = await queryWithSchemaFallback(request, bridge, async (client) => {
          const { error } = await client.from('pitches').insert({
            user_id: userId,
            lead_id: leadId,
            content: pitch,
          })
          return { data: null, error }
        })
        if (persisted.error) warnings.push('Pitch history write failed (pitches insert).')
      } catch {
        warnings.push('Pitch history write failed (pitches insert).')
      }

      // Persist competitive report snapshot (best-effort; user-scoped via RLS).
      try {
        const leadRow = (savedLead.data ?? null) as
          | { company_name?: unknown; company_domain?: unknown; company_url?: unknown }
          | null
        const companyName =
          (typeof leadRow?.company_name === 'string' && leadRow.company_name.trim()) ||
          (typeof topicName === 'string' && topicName.trim()) ||
          (typeof leadRow?.company_domain === 'string' && leadRow.company_domain.trim()) ||
          (typeof input === 'string' && input.trim()) ||
          'Unknown company'
        const companyDomain =
          (typeof leadRow?.company_domain === 'string' && leadRow.company_domain.trim()) ||
          (typeof domain === 'string' && domain.trim()) ||
          null
        const inputUrl = typeof leadRow?.company_url === 'string' ? leadRow.company_url : looksLikeUrl(input) ? input : null

        const title = `Competitive Report: ${companyName}`
        await queryWithSchemaFallback(request, bridge, async (client) => {
          const { error } = await client.from('user_reports').insert({
            user_id: userId,
            status: 'complete',
            company_name: companyName,
            company_domain: companyDomain,
            input_url: inputUrl,
            title,
            report_markdown: pitch,
            report_json: null,
            meta: {
              source: 'generate_pitch',
              lead_id: leadId,
              template_id: template.id,
              hasTriggerEvent,
            },
          })
          return { data: null, error }
        })
      } catch {
        warnings.push('Report history write failed (user_reports insert).')
      }
    } else {
      warnings.push('Pitch history not saved (missing lead id).')
    }

    // Record Starter usage for the 3‑pitch lock UX (best-effort; no DB schema required).
    // We only increment after a lead was successfully created so the counter remains aligned with DB reality.
    if (tier === 'starter' && savedLead.data && typeof pitch === 'string' && pitch.trim().length > 0) {
      try {
        await recordStarterPitchCapUsage({ userId, correlationId })
      } catch {
        // best-effort
      }
    }

    const response = {
      pitch,
      battleCard,
      emailSequence,
      lead: savedLead.data,
      triggerEvent: latestTriggerEvent,
      hasTriggerEvent,
      warnings,
    }

    // Product analytics (best-effort; behind env flag).
    if (serverEnv.ENABLE_PRODUCT_ANALYTICS === '1' || serverEnv.ENABLE_PRODUCT_ANALYTICS === 'true') {
      try {
        const details = await getPlanDetails(supabase, userId)
        await logProductEvent({
          userId,
          eventName: 'pitch_generated',
          eventProps: {
            company_domain: domain,
            company_name: topicName,
            hasTriggerEvent,
            plan: details.plan,
            isAppTrial: Boolean(details.isAppTrial),
          },
        })
      } catch {
        // best-effort
      }
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

    // Webhooks: emit only when pitch was persisted with a lead id.
    if (typeof leadId === 'string' && leadId.length > 0) {
      try {
        await ensurePersonalWorkspace({ supabase, userId })
        const workspace = await getCurrentWorkspace({ supabase, userId })
        if (workspace) {
          await enqueueWebhookEvent({
            workspaceId: workspace.id,
            eventType: 'pitch.generated',
            eventId: randomUUID(),
            payload: {
              workspaceId: workspace.id,
              leadId,
              companyDomain: domain,
              companyName: topicName || null,
              createdAt: new Date().toISOString(),
            },
          })
        }
      } catch {
        // best-effort
      }
    }

    const successResponse = ok(response, undefined, bridge, requestId)
    return successResponse
  },
  {
    bodySchema: CompanyUrlSchema.extend({
      options: GeneratePitchOptionsSchema.omit({ companyUrl: true }).optional(),
      templateId: z.enum(['default', 'short_email', 'call_opener', 'linkedin_dm']).optional(),
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
