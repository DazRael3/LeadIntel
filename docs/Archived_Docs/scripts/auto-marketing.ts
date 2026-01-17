/**
 * Self-Driving Marketing Engine
 * Identifies competitor companies and sends teaser emails
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!
const RESEND_API_KEY = process.env.RESEND_API_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables')
}

if (!OPENAI_API_KEY) {
  throw new Error('Missing OpenAI API key')
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface Lead {
  id: string
  company_name: string
  trigger_event: string
  ai_personalized_pitch: string
  created_at: string
}

interface Competitor {
  company_name: string
  email: string
  reason: string
}

class AutoMarketingEngine {
  /**
   * Get latest 5 leads from database
   */
  async getLatestLeads(): Promise<Lead[]> {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching leads:', error)
      throw error
    }
  }

  /**
   * Use AI to identify 5 competitor companies who would want to sell to these leads
   */
  async identifyCompetitors(leads: Lead[]): Promise<Competitor[]> {
    try {
      const leadsSummary = leads.map(l => 
        `${l.company_name} (${l.trigger_event})`
      ).join(', ')

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a B2B market intelligence expert. Given a list of companies with trigger events, identify 5 competitor companies that would want to sell to these leads. For each competitor, provide:
1. Company name
2. Estimated contact email (format: contact@company.com or sales@company.com)
3. Reason why they would want to sell to these leads

Return the response as a JSON array with this structure:
[
  {
    "company_name": "...",
    "email": "...",
    "reason": "..."
  }
]`,
          },
          {
            role: 'user',
            content: `Identify 5 competitor companies that would want to sell to these leads:
${leadsSummary}

Focus on B2B SaaS companies, sales tools, marketing platforms, or relevant service providers.`,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
        max_tokens: 1000,
      })

      const content = response.choices[0]?.message?.content
      if (!content) throw new Error('No response from OpenAI')

      try {
        const parsed = JSON.parse(content)
        // Handle both {competitors: [...]} and [...] formats
        const competitors = parsed.competitors || (Array.isArray(parsed) ? parsed : Object.values(parsed))

        if (!Array.isArray(competitors)) {
          throw new Error('Invalid response format')
        }

        return competitors.slice(0, 5) as Competitor[]
      } catch (parseError) {
        console.error('Error parsing competitors JSON:', parseError)
        throw new Error('Failed to parse competitors response')
      }
    } catch (error) {
      console.error('Error identifying competitors:', error)
      // Fallback competitors for demo
      return [
        {
          company_name: 'Salesforce',
          email: 'sales@salesforce.com',
          reason: 'Enterprise CRM solutions for growing companies',
        },
        {
          company_name: 'HubSpot',
          email: 'contact@hubspot.com',
          reason: 'Inbound marketing and sales platform',
        },
        {
          company_name: 'Apollo.io',
          email: 'sales@apollo.io',
          reason: 'Sales intelligence and outreach platform',
        },
        {
          company_name: 'Clearbit',
          email: 'hello@clearbit.com',
          reason: 'Data enrichment and lead intelligence',
        },
        {
          company_name: 'ZoomInfo',
          email: 'info@zoominfo.com',
          reason: 'B2B contact database and sales intelligence',
        },
      ]
    }
  }

  /**
   * Draft teaser email using AI
   */
  async draftTeaserEmail(competitor: Competitor, leads: Lead[]): Promise<string> {
    try {
      const leadsPreview = leads
        .slice(0, 3)
        .map(l => `${l.company_name} - ${l.trigger_event}`)
        .join('\n')

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a B2B sales strategist. Write a compelling teaser email to ${competitor.company_name} that:
1. Is professional and concise (3-4 sentences)
2. Shows them we have valuable lead intelligence about companies with trigger events
3. Hints at the quality of our data without revealing too much
4. Includes a clear call-to-action to learn more
5. Tone should be collaborative, not salesy

Format as a plain email (no subject line, just body).`,
          },
          {
            role: 'user',
            content: `Draft a teaser email to ${competitor.company_name} (${competitor.reason}).

Sample leads we have:
${leadsPreview}

Make it compelling and make them want to learn more about our lead intelligence.`,
          },
        ],
        temperature: 0.8,
        max_tokens: 300,
      })

      return response.choices[0]?.message?.content || this.getDefaultEmail(competitor, leads)
    } catch (error) {
      console.error('Error drafting email:', error)
      return this.getDefaultEmail(competitor, leads)
    }
  }

  getDefaultEmail(competitor: Competitor, leads: Lead[]): string {
    return `Hi ${competitor.company_name} Team,

We've identified ${leads.length} high-value B2B leads with recent trigger events that could be perfect for your sales team. These companies are actively growing and looking for solutions.

Would you be interested in learning more about our lead intelligence platform? We'd love to show you how we can help you reach the right companies at the right time.

Best regards,
LeadIntel Team`
  }

  /**
   * Send email using Resend API
   */
  async sendEmail(to: string, subject: string, body: string): Promise<boolean> {
    if (!RESEND_API_KEY) {
      console.warn('⚠️  Resend API key not configured, skipping email send')
      console.log(`Would send email to: ${to}`)
      console.log(`Subject: ${subject}`)
      console.log(`Body: ${body}`)
      return false
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'LeadIntel <noreply@leadintel.com>',
          to: [to],
          subject,
          html: body.replace(/\n/g, '<br>'),
          text: body,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Resend API error: ${error.message || response.statusText}`)
      }

      const data = await response.json()
      console.log(`✅ Email sent to ${to}: ${data.id}`)
      return true
    } catch (error) {
      console.error(`Error sending email to ${to}:`, error)
      return false
    }
  }

  /**
   * Main execution
   */
  async run(): Promise<void> {
    console.log('🚀 Starting Self-Driving Marketing Engine...\n')

    try {
      // Step 1: Get latest 5 leads
      console.log('📊 Fetching latest leads...')
      const leads = await this.getLatestLeads()

      if (leads.length === 0) {
        console.log('No leads found. Exiting.')
        return
      }

      console.log(`✅ Found ${leads.length} leads\n`)

      // Step 2: Identify competitors
      console.log('🎯 Identifying competitor companies...')
      const competitors = await this.identifyCompetitors(leads)
      console.log(`✅ Identified ${competitors.length} competitors\n`)

      // Step 3: Draft and send teaser emails
      console.log('✉️  Drafting and sending teaser emails...\n')

      for (const competitor of competitors) {
        try {
          console.log(`📧 Processing ${competitor.company_name}...`)

          // Draft email
          const emailBody = await this.draftTeaserEmail(competitor, leads)
          const subject = `High-Value B2B Lead Intelligence for ${competitor.company_name}`

          // Send email
          const sent = await this.sendEmail(
            competitor.email,
            subject,
            emailBody
          )

          if (sent) {
            console.log(`✅ Email sent to ${competitor.company_name}\n`)
          } else {
            console.log(`⚠️  Email skipped for ${competitor.company_name} (check logs)\n`)
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (error) {
          console.error(`Error processing ${competitor.company_name}:`, error)
          continue
        }
      }

      console.log('✨ Marketing campaign complete!')
    } catch (error) {
      console.error('Fatal error:', error)
      throw error
    }
  }
}

// Main execution
async function main() {
  const engine = new AutoMarketingEngine()
  try {
    await engine.run()
    process.exit(0)
  } catch (error) {
    console.error('Marketing engine failed:', error)
    process.exit(1)
  }
}

main()
