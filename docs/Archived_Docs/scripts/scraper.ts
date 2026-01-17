/**
 * B2B Lead Intelligence Scraper
 * Monitors news wires and business sources for trigger events
 * Uses Playwright and OpenAI to generate personalized pitches
 */

import { chromium, Browser, Page } from 'playwright'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables')
}

if (!OPENAI_API_KEY) {
  throw new Error('Missing OpenAI API key')
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface NewsSource {
  name: string
  url: string
  selectors: {
    articles: string
    title: string
    link: string
    excerpt?: string
  }
}

const NEWS_SOURCES: NewsSource[] = [
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com',
    selectors: {
      articles: 'article.post-block',
      title: 'h2.post-block__title a',
      link: 'h2.post-block__title a',
      excerpt: '.post-block__content',
    },
  },
  {
    name: 'Crunchbase News',
    url: 'https://news.crunchbase.com',
    selectors: {
      articles: 'article',
      title: 'h2 a',
      link: 'h2 a',
      excerpt: '.excerpt',
    },
  },
]

const TRIGGER_KEYWORDS: Record<string, string[]> = {
  'New Funding': ['funding', 'raised', 'series', 'investment', 'venture capital', 'seed round', 'funded'],
  'New Hires': ['hired', 'appointed', 'joins', 'new executive', 'c-suite', 'new ceo', 'new cto'],
  'Expansion': ['expanding', 'new office', 'entering', 'launching in', 'international', 'global expansion'],
  'Product Launch': ['launched', 'unveils', 'announces', 'new product', 'release', 'rollout'],
  'Partnership': ['partnership', 'partners with', 'collaboration', 'teams up', 'strategic alliance'],
}

class LeadScraper {
  private browser: Browser | null = null

  async init(): Promise<void> {
    this.browser = await chromium.launch({ headless: true })
    console.log('✅ Browser launched')
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      console.log('✅ Browser closed')
    }
  }

  async scrapeSource(source: NewsSource): Promise<any[]> {
    if (!this.browser) throw new Error('Browser not initialized')

    const page: Page = await this.browser.newPage()
    const leads: any[] = []

    try {
      console.log(`🔍 Scraping ${source.name}...`)
      await page.goto(source.url, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForSelector(source.selectors.articles, { timeout: 10000 })

      const articleElements = await page.$$(source.selectors.articles)

      for (let i = 0; i < Math.min(articleElements.length, 10); i++) {
        const element = articleElements[i]

        try {
          const titleElement = await element.$(source.selectors.title)
          if (!titleElement) continue

          const title = await titleElement.innerText()
          const link = await element.getAttribute(source.selectors.link) || 
                      await titleElement.getAttribute('href') || ''
          const fullLink = link.startsWith('http') ? link : new URL(link, source.url).href

          const excerptElement = source.selectors.excerpt 
            ? await element.$(source.selectors.excerpt)
            : null
          const excerpt = excerptElement ? await excerptElement.innerText() : ''

          // Check if article contains trigger keywords
          const triggerEvent = this.detectTriggerEvent(title + ' ' + excerpt)

          if (triggerEvent) {
            // Extract company name using AI
            const companyName = await this.extractCompanyName(title, excerpt)

            // Check if lead already exists
            const { data: existing } = await supabase
              .from('leads')
              .select('id')
              .eq('company_name', companyName)
              .eq('trigger_event', triggerEvent)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            if (existing) {
              console.log(`⏭️  Skipping duplicate: ${companyName}`)
              continue
            }

            // Enrich lead with LinkedIn and Email
            const enrichment = await this.enrichLead(companyName)
            console.log(`🔍 Enriching ${companyName}...`)

            // Generate AI-powered personalized pitch
            const pitch = await this.generatePitch(companyName, triggerEvent, title, excerpt)

            leads.push({
              company_name: companyName,
              trigger_event: triggerEvent,
              contact_email: null, // Legacy field
              prospect_email: enrichment.email,
              prospect_linkedin: enrichment.linkedin,
              ai_personalized_pitch: pitch,
              source_url: fullLink,
            })

            console.log(`✅ Found lead: ${companyName} - ${triggerEvent}`)
          }
        } catch (error) {
          console.error(`Error processing article ${i}:`, error)
          continue
        }
      }
    } catch (error) {
      console.error(`Error scraping ${source.name}:`, error)
    } finally {
      await page.close()
    }

    return leads
  }

  detectTriggerEvent(text: string): string | null {
    const textLower = text.toLowerCase()

    for (const [eventType, keywords] of Object.entries(TRIGGER_KEYWORDS)) {
      if (keywords.some(keyword => textLower.includes(keyword.toLowerCase()))) {
        return eventType
      }
    }

    return null
  }

  async extractCompanyName(title: string, excerpt: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Extract the company name from the following news article. Return ONLY the company name, nothing else. If you cannot identify a company, return "Unknown Company".',
          },
          {
            role: 'user',
            content: `Title: ${title}\n\nExcerpt: ${excerpt.substring(0, 300)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 50,
      })

      return response.choices[0]?.message?.content?.trim() || 'Unknown Company'
    } catch (error) {
      console.error('Error extracting company name:', error)
      // Fallback: use first few words of title
      return title.split(' ').slice(0, 3).join(' ')
    }
  }

  /**
   * Enrichment Engine: Fetch LinkedIn Profile and Verified Email
   * Placeholder implementation for production API integration
   */
  async enrichLead(companyName: string): Promise<{ linkedin?: string; email?: string }> {
    try {
      // PLACEHOLDER: In production, replace with actual enrichment API
      // Examples: Apollo.io, Clearbit, Hunter.io, Lusha, etc.
      
      const enrichmentApiUrl = process.env.ENRICHMENT_API_URL || 'https://api.enrichment-service.com/v1/leads'
      const apiKey = process.env.ENRICHMENT_API_KEY

      if (!apiKey) {
        console.log('⚠️  Enrichment API key not configured, using placeholder data')
        // Return placeholder data for development
        return {
          linkedin: `https://www.linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '-')}`,
          email: `contact@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        }
      }

      // PLACEHOLDER API CALL - Replace with actual implementation
      const response = await fetch(enrichmentApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          company: companyName,
        }),
      })

      if (!response.ok) {
        console.warn(`Enrichment API returned ${response.status}, using placeholder data`)
        return {
          linkedin: `https://www.linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '-')}`,
          email: `contact@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        }
      }

      const data = await response.json()
      return {
        linkedin: data.linkedin_url || data.linkedin_profile || undefined,
        email: data.verified_email || data.email || undefined,
      }
    } catch (error) {
      console.error('Error enriching lead:', error)
      // Return placeholder data on error
      return {
        linkedin: `https://www.linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '-')}`,
        email: `contact@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      }
    }
  }

  async generatePitch(
    companyName: string,
    triggerEvent: string,
    title: string,
    excerpt: string
  ): Promise<string> {
    try {
      // Import the centralized AI logic
      const { generatePitch } = await import('../lib/ai-logic')
      const additionalContext = `News Title: ${title}\nContext: ${excerpt.substring(0, 500)}`
      
      return await generatePitch(companyName, triggerEvent, undefined, additionalContext)
    } catch (error) {
      console.error('Error generating pitch:', error)
      // Fallback pitch with correct format
      return `I've already generated a competitive intelligence report for ${companyName} based on your recent ${triggerEvent}. View it here: https://dazrael.com`
    }
  }

  async saveLeads(leads: any[]): Promise<void> {
    if (leads.length === 0) {
      console.log('No new leads to save')
      return
    }

    try {
      const { data, error } = await supabase
        .from('leads')
        .insert(leads)
        .select()

      if (error) throw error

      console.log(`✅ Saved ${leads.length} leads to database`)
    } catch (error) {
      console.error('Error saving leads:', error)
      throw error
    }
  }

  async run(): Promise<void> {
    console.log('🚀 Starting B2B Lead Intelligence Scraper...\n')

    await this.init()

    const allLeads: any[] = []

    try {
      for (const source of NEWS_SOURCES) {
        const leads = await this.scrapeSource(source)
        allLeads.push(...leads)
        await new Promise(resolve => setTimeout(resolve, 2000)) // Rate limiting
      }

      if (allLeads.length > 0) {
        await this.saveLeads(allLeads)
        console.log(`\n✨ Scraping complete! Found ${allLeads.length} new leads.`)
      } else {
        console.log('\n✨ Scraping complete! No new leads found.')
      }
    } catch (error) {
      console.error('Fatal error:', error)
      throw error
    } finally {
      await this.close()
    }
  }
}

// Main execution
async function main() {
  const scraper = new LeadScraper()
  try {
    await scraper.run()
    process.exit(0)
  } catch (error) {
    console.error('Scraper failed:', error)
    process.exit(1)
  }
}

main()
