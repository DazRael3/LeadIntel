/**
 * Centralized AI Pitch Generation Logic
 * Generates pitches that drive leads to sign up for Instant Intelligence
 */

import OpenAI from 'openai'

const DEFAULT_WEBSITE_URL = 'https://leadintel.com'
const WEBSITE_URL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim()
    ? process.env.NEXT_PUBLIC_SITE_URL.trim()
    : DEFAULT_WEBSITE_URL
const WEBSITE_HOST = (() => {
  try {
    return new URL(WEBSITE_URL).hostname
  } catch {
    return 'leadintel.com'
  }
})()

import { serverEnv } from './env'
import { isE2E, isTestEnv } from './runtimeFlags'
import { captureException, captureMessage } from './observability/sentry'

// Lazy initialization of OpenAI client
function getOpenAIClient(): OpenAI {
  // Use validated environment variable (validated at module load time)
  const apiKey = serverEnv.OPENAI_API_KEY
  
  // OpenAI SDK automatically adds 'Bearer ' prefix to the Authorization header
  // The header will be: 'Authorization': `Bearer ${apiKey}`
  return new OpenAI({ apiKey })
}

export interface DealScoringInput {
  fundingAmount?: number | null
  industry?: string | null
  triggerEvent: string
  companyName: string
  growthSignals?: string[]
  companyInfo?: string | null
  yearsInBusiness?: number | null // For Enterprise Stability calculation
  techStackCount?: number | null // For Enterprise Stability calculation
  recentHiringCount?: number | null // For Startup Score calculation
  userSettings?: {
    targetIndustries?: string[]
    whatYouSell?: string
    idealCustomer?: string
  }
}

export interface BattleCard {
  currentTech: string[]
  painPoint: string
  killerFeature: string
}

export interface EmailSequence {
  part1: string // Helpful tone
  part2: string // Data-driven tone
  part3: string // Short/Final follow-up
}

/**
 * Deal Scoring Engine
 * Calculates dual scores: Growth Potential (for Startups) and Enterprise Stability (for Large Biz)
 */
export async function calculateDealScore(input: DealScoringInput): Promise<{
  fitScore: number // Overall fit (average of both scores)
  growthPotential: number // 0-100: For startups, based on funding rounds, growth signals
  enterpriseStability: number // 0-100: For large companies, based on revenue indicators, Fortune 500 status
  breakdown: {
    fundingScore: number
    industryScore: number
    growthScore: number
    customScore: number
    stabilityScore: number
  }
  growthSignals: string[]
}> {
  let fitScore = 0
  let fundingScore = 0
  let industryScore = 0
  let growthScore = 0
  let customScore = 0
  let stabilityScore = 0
  let growthPotential = 0
  let enterpriseStability = 0
  const growthSignals: string[] = []

  // 1. Funding Amount Score (0-40 points)
  // This boosts Growth Potential for startups
  if (input.fundingAmount) {
    if (input.fundingAmount >= 50000000) {
      fundingScore = 40 // Series C+ or massive funding
    } else if (input.fundingAmount >= 20000000) {
      fundingScore = 35 // Series B
    } else if (input.fundingAmount >= 10000000) {
      fundingScore = 30 // Series A
    } else if (input.fundingAmount >= 5000000) {
      fundingScore = 25 // Seed/Series A-
    } else if (input.fundingAmount >= 1000000) {
      fundingScore = 20 // Early stage
    } else {
      fundingScore = 10 // Small funding
    }
  } else {
    // No funding info, check if trigger event suggests growth
    const eventLower = input.triggerEvent.toLowerCase()
    if (eventLower.includes('funding') || eventLower.includes('raised') || eventLower.includes('investment')) {
      fundingScore = 20 // Assume some funding but unknown amount
    }
  }

  // Growth Potential: Boost for Seed/Series A/B (startup indicators)
  if (input.fundingAmount) {
    if (input.fundingAmount < 10000000 && input.fundingAmount >= 1000000) {
      // Seed/Series A range - high growth potential
      growthPotential += 30
    } else if (input.fundingAmount >= 10000000 && input.fundingAmount < 50000000) {
      // Series A/B - good growth potential
      growthPotential += 25
    }
  }
  
  // Check for startup keywords in trigger event
  const eventLower = input.triggerEvent.toLowerCase()
  if (eventLower.includes('seed') || eventLower.includes('series a') || eventLower.includes('series b')) {
    growthPotential += 20
  }

  // 2. Industry Match Score (0-30 points)
  if (input.userSettings?.targetIndustries && input.userSettings.targetIndustries.length > 0) {
    if (input.industry) {
      const targetIndustriesLower = input.userSettings.targetIndustries.map(i => i.toLowerCase())
      const leadIndustryLower = input.industry.toLowerCase()
      
      // Exact match
      if (targetIndustriesLower.includes(leadIndustryLower)) {
        industryScore = 30
      } else {
        // Partial match (check for keywords)
        const matched = targetIndustriesLower.some(target => 
          leadIndustryLower.includes(target) || target.includes(leadIndustryLower)
        )
        if (matched) {
          industryScore = 20
        } else {
          industryScore = 5 // Different industry
        }
      }
    } else {
      // No industry info, give neutral score
      industryScore = 15
    }
  } else {
    // No user preferences, give neutral score
    industryScore = 15
  }

  // 3. Growth Signals Score (0-20 points)
  // These boost Growth Potential for startups
  
  if (eventLower.includes('hiring') || eventLower.includes('hired') || eventLower.includes('expanding team')) {
    growthScore += 20
    growthPotential += 15 // Boost growth potential
    growthSignals.push('Active Hiring')
  }
  if (eventLower.includes('expansion') || eventLower.includes('expanding') || eventLower.includes('new office')) {
    growthScore += 15
    growthPotential += 12
    growthSignals.push('Geographic Expansion')
  }
  if (eventLower.includes('new product') || eventLower.includes('product launch') || eventLower.includes('launched')) {
    growthScore += 12
    growthPotential += 10
    growthSignals.push('Product Launch')
  }
  if (eventLower.includes('partnership') || eventLower.includes('partnered')) {
    growthScore += 10
    growthPotential += 8
    growthSignals.push('Strategic Partnership')
  }
  if (eventLower.includes('acquisition') || eventLower.includes('acquired')) {
    growthScore += 8
    growthPotential += 5
    growthSignals.push('M&A Activity')
  }

  // Cap growth score at 20
  growthScore = Math.min(growthScore, 20)
  
  // Enterprise Stability: Check for Fortune 500, revenue indicators, large company signals
  const companyNameLower = input.companyName.toLowerCase()
  const companyInfoLower = (input.companyInfo || '').toLowerCase()
  const combinedText = `${companyNameLower} ${companyInfoLower} ${eventLower}`
  
  // Fortune 500 keywords
  if (combinedText.includes('fortune 500') || combinedText.includes('fortune500') || 
      combinedText.includes('f500') || combinedText.includes('s&p 500') || 
      combinedText.includes('s&p500')) {
    stabilityScore += 40
    enterpriseStability += 35
  }
  
  // Revenue indicators
  if (combinedText.includes('revenue') || combinedText.includes('annual revenue') || 
      combinedText.includes('billion') || combinedText.includes('$b')) {
    stabilityScore += 30
    enterpriseStability += 25
  }
  
  // Large company indicators
  if (combinedText.includes('enterprise') || combinedText.includes('enterprises') ||
      combinedText.includes('corporation') || combinedText.includes('corp') ||
      combinedText.includes('inc.') || combinedText.includes('incorporated')) {
    stabilityScore += 15
    enterpriseStability += 12
  }
  
  // Series C+ funding suggests enterprise stability
  if (input.fundingAmount && input.fundingAmount >= 50000000) {
    stabilityScore += 25
    enterpriseStability += 20
  }
  
  // Cap stability score
  stabilityScore = Math.min(stabilityScore, 40)

  // 4. Custom Fit Score (0-10 points) - Based on user's "what you sell" and ideal customer
  if (input.userSettings?.whatYouSell && input.userSettings?.idealCustomer) {
    // Use AI to determine fit if OpenAI is available
    try {
      const openai = getOpenAIClient()
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a B2B lead scoring expert. Rate how well a lead matches a seller\'s ideal customer profile. Return only a number between 0-10.',
          },
          {
            role: 'user',
            content: `Seller offers: ${input.userSettings.whatYouSell}
Ideal Customer: ${input.userSettings.idealCustomer}
Lead Company: ${input.companyName}
Lead Industry: ${input.industry || 'Unknown'}
Trigger Event: ${input.triggerEvent}

Rate the fit (0-10):`,
          },
        ],
        temperature: 0.3,
        max_tokens: 10,
      })

      const scoreText = response.choices[0]?.message?.content?.trim() || '5'
      customScore = Math.min(10, Math.max(0, parseInt(scoreText) || 5))
    } catch (error) {
      // Fallback: give moderate score if AI fails
      customScore = 5
    }
  } else {
    customScore = 5 // Default if no user settings
  }

  // Calculate Startup Score (Growth Potential) using Dual-Lens formula
  // Startup Score = (Funding < 5M ? 40 : 10) + (RecentHiringCount * 5)
  const fundingAmount = input.fundingAmount || 0
  const recentHiringCount = input.recentHiringCount || 0
  
  growthPotential = (fundingAmount < 5000000 ? 40 : 10) + (recentHiringCount * 5)
  growthPotential = Math.min(100, Math.max(0, growthPotential))
  
  // Calculate Enterprise Stability using Dual-Lens formula
  // Enterprise Score = (Funding > 20M ? 40 : 10) + (YearsInBusiness > 5 ? 30 : 10) + (TechStackCount * 5)
  const yearsInBusiness = input.yearsInBusiness || 0
  const techStackCount = input.techStackCount || 0
  
  enterpriseStability = (fundingAmount > 20000000 ? 40 : 10) + 
                        (yearsInBusiness > 5 ? 30 : 10) + 
                        (techStackCount * 5)
  enterpriseStability = Math.min(100, Math.max(0, enterpriseStability))
  
  // Calculate total fit score (average of both, weighted toward the higher one)
  const avgScore = (growthPotential + enterpriseStability) / 2
  const maxScore = Math.max(growthPotential, enterpriseStability)
  fitScore = Math.round(avgScore * 0.6 + maxScore * 0.4)

  return {
    fitScore: Math.min(100, Math.max(0, fitScore)),
    growthPotential,
    enterpriseStability,
    breakdown: {
      fundingScore: Math.round(fundingScore),
      industryScore: Math.round(industryScore),
      growthScore: Math.round(growthScore),
      customScore: Math.round(customScore),
      stabilityScore: Math.round(stabilityScore),
    },
    growthSignals: growthSignals.length > 0 ? growthSignals : ['Active Growth Signals Detected'],
  }
}

/**
 * Generate a pitch using OpenAI
 * Never mentions calls or meetings - focuses on driving website signups
 */
export async function generatePitch(
  companyName: string,
  triggerEvent: string | null,
  ceoName: string | null,
  companyInfo: string | null,
  userSettings?: {
    whatYouSell?: string
    idealCustomer?: string
  }
): Promise<string> {
  // In E2E/test mode, return deterministic mock response instantly
  if (isE2E() || isTestEnv()) {
    return `Hi ${ceoName || 'there'}, I've created a competitive intelligence report for ${companyName} based on your recent ${triggerEvent || 'activity'}. View it here: ${WEBSITE_URL}`
  }

  try {
    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a world-class sales strategist. Write concise, high-converting sales emails that:
- Are exactly 3-4 sentences long
- Have a helpful, not salesy tone
- NEVER mention calls, meetings, or scheduling
- Focus on driving the recipient to visit a website and sign up
- The key message: "I've already generated a competitive intelligence report for you. View it here."
- Always end with a clear call-to-action linking to ${WEBSITE_URL}
- Make it feel like valuable intelligence is waiting for them, not a sales pitch`,
        },
        {
          role: 'user',
          content: `Write an email to ${ceoName || 'the leadership team'} of ${companyName}.

Reference their recent ${triggerEvent} specifically.

The tone should convey: "I've already generated a competitive intelligence report for you. View it here."

${companyInfo ? `Additional context: ${companyInfo}` : ''}
${userSettings?.whatYouSell ? `We sell: ${userSettings.whatYouSell}` : ''}
${userSettings?.idealCustomer ? `Our ideal customer: ${userSettings.idealCustomer}` : ''}

End with a clear link to ${WEBSITE_URL} encouraging them to sign up for Instant Intelligence.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 250,
    })
    // Never log raw provider payloads (may contain sensitive user input).
    
    // Check if response structure is correct
    const content = response.choices?.[0]?.message?.content
    let pitch = content?.trim() || ''
    
    if (!pitch) {
      captureMessage('ai_empty_response', { route: 'lib/ai-logic.generatePitch' })
      return 'AI failed to generate pitch. Please check OpenAI credits.'
    }

    // Ensure the website URL is included (accept host-only matches too).
    if (!pitch.includes(WEBSITE_URL) && !pitch.includes(WEBSITE_HOST)) {
      pitch += `\n\nView your competitive intelligence report: ${WEBSITE_URL}`
    }

    // Remove any mentions of calls or meetings
    pitch = pitch
      .replace(/10-minute (call|meeting|discovery)/gi, 'your report')
      .replace(/schedule a call/gi, 'view your report')
      .replace(/let's (talk|discuss|connect)/gi, 'view your report')
      .replace(/would you like to (talk|discuss|connect)/gi, 'view your report')
      .replace(/call|meeting|schedule|zoom|meet/gi, (match) => {
        // Only remove if it's clearly about scheduling
        if (match.toLowerCase().includes('call') || match.toLowerCase().includes('meeting')) {
          return 'report'
        }
        return match
      })

    return pitch.trim()
  } catch (error) {
    captureException(error, { route: 'lib/ai-logic.generatePitch' })
    // Fallback pitch
    return `Hi ${ceoName || 'there'}, I've already generated a competitive intelligence report for ${companyName} based on your recent ${triggerEvent}. View it here: ${WEBSITE_URL}`
  }
}

/**
 * Generate Battle Card - 3-point competitive intelligence
 * Enterprise Intelligence feature
 */
export async function generateBattleCard(
  companyName: string,
  triggerEvent: string | null,
  companyInfo: string | null,
  userSettings?: {
    whatYouSell?: string
    idealCustomer?: string
  }
): Promise<BattleCard> {
  // In E2E/test mode, return deterministic mock response instantly
  if (isE2E() || isTestEnv()) {
    return {
      currentTech: ['CRM Platform', 'Email Marketing', 'Analytics Tools'],
      painPoint: 'Scaling sales operations while maintaining quality',
      killerFeature: 'Automated lead scoring and personalized outreach',
    }
  }

  try {
    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a competitive intelligence analyst. Create a 3-point battle card:
1. Likely Current Tech: List 3-4 technologies/tools they likely use (based on company size, industry, recent events)
2. Pain Point: Identify their main challenge based on trigger events and industry trends
3. Killer Feature: Suggest the one feature from our solution that would solve their pain point

Be specific, actionable, and data-driven.`,
        },
        {
          role: 'user',
          content: `Create a battle card for ${companyName}.

Recent Event: ${triggerEvent || 'Unknown'}
${companyInfo ? `Company Info: ${companyInfo}` : ''}
${userSettings?.whatYouSell ? `Our Solution: ${userSettings.whatYouSell}` : ''}
${userSettings?.idealCustomer ? `Ideal Customer: ${userSettings.idealCustomer}` : ''}

Return as JSON:
{
  "currentTech": ["tech1", "tech2", "tech3"],
  "painPoint": "their main challenge...",
  "killerFeature": "the feature that solves it..."
}`,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 400,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Failed to generate battle card')
    }

    const battleCard = JSON.parse(content)

    // Ensure currentTech is an array
    if (typeof battleCard.currentTech === 'string') {
      battleCard.currentTech = battleCard.currentTech.split(',').map((t: string) => t.trim())
    } else if (!Array.isArray(battleCard.currentTech)) {
      battleCard.currentTech = []
    }

    return {
      currentTech: battleCard.currentTech || [],
      painPoint: battleCard.painPoint || 'Growth challenges requiring scalable solutions',
      killerFeature: battleCard.killerFeature || 'AI-powered lead intelligence',
    }
  } catch (error) {
    captureException(error, { route: 'lib/ai-logic.generateBattleCard' })
    // Fallback battle card
    return {
      currentTech: ['CRM Platform', 'Email Marketing', 'Analytics Tools'],
      painPoint: 'Scaling sales operations while maintaining quality',
      killerFeature: 'Automated lead scoring and personalized outreach',
    }
  }
}

/**
 * Generate 3-Part Email Sequence
 * Enterprise Intelligence feature
 */
export async function generateEmailSequence(
  companyName: string,
  triggerEvent: string | null,
  ceoName: string | null,
  companyInfo: string | null,
  userSettings?: {
    whatYouSell?: string
    idealCustomer?: string
  }
): Promise<EmailSequence> {
  // In E2E/test mode, return deterministic mock response instantly
  if (isE2E() || isTestEnv()) {
    return {
      part1: `Hi ${ceoName || 'there'}, I noticed ${companyName} recently ${triggerEvent || 'had some activity'}. I've prepared a competitive intelligence report that might be valuable.`,
      part2: `Based on your recent ${triggerEvent || 'activity'}, companies in your position typically see 40% faster growth when leveraging AI-powered lead intelligence. View your customized report: ${WEBSITE_URL}`,
      part3: `Final reminder: Your competitive intelligence report for ${companyName} is ready. View it here: ${WEBSITE_URL}`,
    }
  }

  try {
    const openai = getOpenAIClient()
    
    // Generate all 3 parts
    const [part1, part2, part3] = await Promise.all([
      // Part 1: Helpful tone
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a helpful consultant. Write the FIRST email in a 3-part sequence.
Tone: Helpful, warm, value-first
Length: 2-3 sentences
Goal: Provide genuine value and introduce yourself
NEVER mention calls or meetings
Always end with link to ${WEBSITE_URL}`,
          },
          {
            role: 'user',
            content: `Write Email 1 (Helpful tone) to ${ceoName || 'the leadership team'} of ${companyName}.
Reference: ${triggerEvent || 'their recent growth'}
${userSettings?.whatYouSell ? `Context: We offer ${userSettings.whatYouSell}` : ''}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 150,
      }),
      // Part 2: Data-driven tone
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a data analyst. Write the SECOND email in a 3-part sequence.
Tone: Data-driven, analytical, specific
Length: 3-4 sentences
Goal: Show concrete insights and metrics
Include numbers, percentages, or specific data points
NEVER mention calls or meetings
Always end with link to ${WEBSITE_URL}`,
          },
          {
            role: 'user',
            content: `Write Email 2 (Data-driven tone) to ${ceoName || 'the leadership team'} of ${companyName}.
Reference: ${triggerEvent || 'their recent growth'}
${companyInfo ? `Company Info: ${companyInfo}` : ''}
${userSettings?.whatYouSell ? `Context: We offer ${userSettings.whatYouSell}` : ''}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
      // Part 3: Short/Final follow-up
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a respectful closer. Write the THIRD email in a 3-part sequence.
Tone: Brief, respectful, final follow-up
Length: 1-2 sentences MAX
Goal: One final reminder without being pushy
NEVER mention calls or meetings
Always end with link to ${WEBSITE_URL}`,
          },
          {
            role: 'user',
            content: `Write Email 3 (Final follow-up, SHORT) to ${ceoName || 'the leadership team'} of ${companyName}.
This is the final email in the sequence. Keep it brief and respectful.`,
          },
        ],
        temperature: 0.6,
        max_tokens: 100,
      }),
    ])

    return {
      part1: part1.choices[0]?.message?.content?.trim() || 
            `Hi ${ceoName || 'there'}, I've created a competitive intelligence report for ${companyName} based on your recent ${triggerEvent}. View it here: ${WEBSITE_URL}`,
      part2: part2.choices[0]?.message?.content?.trim() || 
            `Based on your recent ${triggerEvent}, companies in your position typically see 40% faster growth when leveraging AI-powered lead intelligence. View your customized report: ${WEBSITE_URL}`,
      part3: part3.choices[0]?.message?.content?.trim() || 
            `Final reminder: Your competitive intelligence report for ${companyName} is ready. View it here: ${WEBSITE_URL}`,
    }
  } catch (error) {
    captureException(error, { route: 'lib/ai-logic.generateEmailSequence' })
    // Fallback sequence
    return {
      part1: `Hi ${ceoName || 'there'}, I've created a competitive intelligence report for ${companyName} based on your recent ${triggerEvent}. View it here: ${WEBSITE_URL}`,
      part2: `Based on your recent ${triggerEvent}, companies in your position typically see 40% faster growth when leveraging AI-powered lead intelligence. View your customized report: ${WEBSITE_URL}`,
      part3: `Final reminder: Your competitive intelligence report for ${companyName} is ready. View it here: ${WEBSITE_URL}`,
    }
  }
}
