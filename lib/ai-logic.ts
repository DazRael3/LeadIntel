/**
 * Centralized AI Pitch Generation Logic
 * Generates pitches that drive leads to sign up for Instant Intelligence
 */

import { getAppUrl } from '@/lib/app-url'
import { isE2E, isTestEnv } from './runtimeFlags'
import { captureException, captureMessage } from './observability/sentry'
import { getPitchTemplate, type PitchTemplateId } from '@/lib/ai/pitch-templates'
import { generateWithProviderRouter } from '@/lib/ai/providerRouter'

const COMPETITIVE_REPORT_URL = `${getAppUrl()}/competitive-report?auto=1`
const COMPETITIVE_REPORT_CTA = `Generate a sourced competitive report here: ${COMPETITIVE_REPORT_URL}`

export interface DealScoringInput {
  fundingAmount?: number | null
  industry?: string | null
  triggerEvent: string
  companyName: string
  growthSignals?: string[]
  companyInfo?: string | null
  yearsInBusiness?: number | null
  techStackCount?: number | null
  recentHiringCount?: number | null
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
  part1: string
  part2: string
  part3: string
}

function fallbackFitScore(input: DealScoringInput): number {
  const companyText = `${input.companyName} ${input.companyInfo ?? ''} ${input.triggerEvent}`.toLowerCase()
  let score = 5
  if (input.userSettings?.idealCustomer) {
    const ideal = input.userSettings.idealCustomer.toLowerCase()
    if (companyText.includes(ideal.slice(0, 14))) score += 2
  }
  if (input.userSettings?.whatYouSell) {
    const offer = input.userSettings.whatYouSell.toLowerCase()
    if (companyText.includes(offer.slice(0, 12))) score += 1
  }
  if (input.industry && input.userSettings?.targetIndustries?.length) {
    const industry = input.industry.toLowerCase()
    if (input.userSettings.targetIndustries.some((item) => item.toLowerCase().includes(industry))) {
      score += 2
    }
  }
  return Math.max(0, Math.min(10, score))
}

/**
 * Deal Scoring Engine
 * Calculates dual scores: Growth Potential (for Startups) and Enterprise Stability (for Large Biz)
 */
export async function calculateDealScore(input: DealScoringInput): Promise<{
  fitScore: number
  growthPotential: number
  enterpriseStability: number
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

  if (input.fundingAmount) {
    if (input.fundingAmount >= 50000000) fundingScore = 40
    else if (input.fundingAmount >= 20000000) fundingScore = 35
    else if (input.fundingAmount >= 10000000) fundingScore = 30
    else if (input.fundingAmount >= 5000000) fundingScore = 25
    else if (input.fundingAmount >= 1000000) fundingScore = 20
    else fundingScore = 10
  } else {
    const eventLower = input.triggerEvent.toLowerCase()
    if (
      eventLower.includes('funding') ||
      eventLower.includes('raised') ||
      eventLower.includes('investment')
    ) {
      fundingScore = 20
    }
  }

  if (input.fundingAmount) {
    if (input.fundingAmount < 10000000 && input.fundingAmount >= 1000000) growthPotential += 30
    else if (input.fundingAmount >= 10000000 && input.fundingAmount < 50000000) growthPotential += 25
  }

  const eventLower = input.triggerEvent.toLowerCase()
  if (eventLower.includes('seed') || eventLower.includes('series a') || eventLower.includes('series b')) {
    growthPotential += 20
  }

  if (input.userSettings?.targetIndustries && input.userSettings.targetIndustries.length > 0) {
    if (input.industry) {
      const targetIndustriesLower = input.userSettings.targetIndustries.map((value) => value.toLowerCase())
      const leadIndustryLower = input.industry.toLowerCase()
      if (targetIndustriesLower.includes(leadIndustryLower)) {
        industryScore = 30
      } else {
        const matched = targetIndustriesLower.some(
          (target) => leadIndustryLower.includes(target) || target.includes(leadIndustryLower)
        )
        industryScore = matched ? 20 : 5
      }
    } else {
      industryScore = 15
    }
  } else {
    industryScore = 15
  }

  if (eventLower.includes('hiring') || eventLower.includes('hired') || eventLower.includes('expanding team')) {
    growthScore += 20
    growthPotential += 15
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
  growthScore = Math.min(growthScore, 20)

  const companyNameLower = input.companyName.toLowerCase()
  const companyInfoLower = (input.companyInfo || '').toLowerCase()
  const combinedText = `${companyNameLower} ${companyInfoLower} ${eventLower}`
  if (
    combinedText.includes('fortune 500') ||
    combinedText.includes('fortune500') ||
    combinedText.includes('f500') ||
    combinedText.includes('s&p 500') ||
    combinedText.includes('s&p500')
  ) {
    stabilityScore += 40
    enterpriseStability += 35
  }
  if (
    combinedText.includes('revenue') ||
    combinedText.includes('annual revenue') ||
    combinedText.includes('billion') ||
    combinedText.includes('$b')
  ) {
    stabilityScore += 30
    enterpriseStability += 25
  }
  if (
    combinedText.includes('enterprise') ||
    combinedText.includes('enterprises') ||
    combinedText.includes('corporation') ||
    combinedText.includes('corp') ||
    combinedText.includes('inc.') ||
    combinedText.includes('incorporated')
  ) {
    stabilityScore += 15
    enterpriseStability += 12
  }
  if (input.fundingAmount && input.fundingAmount >= 50000000) {
    stabilityScore += 25
    enterpriseStability += 20
  }
  stabilityScore = Math.min(stabilityScore, 40)

  customScore = fallbackFitScore(input)

  const fundingAmount = input.fundingAmount || 0
  const recentHiringCount = input.recentHiringCount || 0
  growthPotential = (fundingAmount < 5000000 ? 40 : 10) + recentHiringCount * 5
  growthPotential = Math.min(100, Math.max(0, growthPotential))

  const yearsInBusiness = input.yearsInBusiness || 0
  const techStackCount = input.techStackCount || 0
  enterpriseStability =
    (fundingAmount > 20000000 ? 40 : 10) + (yearsInBusiness > 5 ? 30 : 10) + techStackCount * 5
  enterpriseStability = Math.min(100, Math.max(0, enterpriseStability))

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

function normalizePitchText(raw: string): string {
  let pitch = raw
    .replace(/^View your competitive intelligence report:.*$/gim, COMPETITIVE_REPORT_CTA)
    .replace(/^View your customized report:.*$/gim, COMPETITIVE_REPORT_CTA)
    .replace(/^View your\s+.*report.*here.*$/gim, COMPETITIVE_REPORT_CTA)
    .replace(/^View it here:\s*https?:\/\/\S+.*$/gim, COMPETITIVE_REPORT_CTA)
    .replace(/specifi\w+/gi, 'specific')
    .replace(
      /https?:\/\/(?:www\.)?[^/\s]+\/competitive-report\/new\S*/gi,
      COMPETITIVE_REPORT_URL
    )
    .replace(
      /https?:\/\/(?:www\.)?[^/\s]+\/competitive-report(?!\/new)\S*/gi,
      COMPETITIVE_REPORT_URL
    )

  if (!pitch.includes(COMPETITIVE_REPORT_URL)) {
    pitch = `${pitch.trim()}\n\n${COMPETITIVE_REPORT_CTA}`
  }

  return pitch
    .replace(/10-minute (call|meeting|discovery)/gi, 'your report')
    .replace(/schedule a call/gi, 'view your report')
    .replace(/let's (talk|discuss|connect)/gi, 'view your report')
    .replace(/would you like to (talk|discuss|connect)/gi, 'view your report')
    .replace(/call|meeting|schedule|zoom|meet/gi, (match) =>
      match.toLowerCase().includes('call') || match.toLowerCase().includes('meeting')
        ? 'report'
        : match
    )
    .trim()
}

/**
 * Generate a pitch using provider router.
 * Never mentions calls or meetings - focuses on driving website signups.
 */
export async function generatePitch(
  companyName: string,
  triggerEvent: string | null,
  ceoName: string | null,
  companyInfo: string | null,
  userSettings?: {
    whatYouSell?: string
    idealCustomer?: string
  },
  whyNow?: {
    bullets: string[]
  },
  templateId?: PitchTemplateId
): Promise<string> {
  if (isE2E() || isTestEnv()) {
    return `Hi ${ceoName || 'there'}, I put together a sourced competitive intelligence report for ${companyName} based on your recent ${triggerEvent || 'activity'}.\n\n${COMPETITIVE_REPORT_CTA}`
  }

  const template = getPitchTemplate(templateId ?? 'default')
  const whyNowText =
    whyNow?.bullets && whyNow.bullets.length > 0
      ? `\n\nWhy now (use ONLY these points, do not add new claims):\n- ${whyNow.bullets
          .slice(0, 3)
          .join('\n- ')}`
      : ''

  try {
    const aiResult = await generateWithProviderRouter({
      task: 'outreach_draft',
      system: template.systemInstruction.replaceAll(
        'the provided website URL',
        COMPETITIVE_REPORT_URL
      ),
      prompt: `Write an email to ${ceoName || 'the leadership team'} of ${companyName}.

Reference their recent ${triggerEvent} specifically.

If relevant, incorporate up to 1-2 of the "Why now" points below into the email (no bullet lists in the final email; weave them naturally). Never invent events.

The tone should convey: "I’ve put together a sourced competitive intelligence report you can generate now."

${companyInfo ? `Additional context: ${companyInfo}` : ''}
${userSettings?.whatYouSell ? `We sell: ${userSettings.whatYouSell}` : ''}
${userSettings?.idealCustomer ? `Our ideal customer: ${userSettings.idealCustomer}` : ''}${whyNowText}

End with a clear link to ${COMPETITIVE_REPORT_URL} encouraging them to generate the report.`,
      temperature: 0.7,
      maxTokens: 250,
      metadata: {
        route: '/lib/ai-logic.generatePitch',
        companyName,
      },
    })

    if (!aiResult.ok || !aiResult.text.trim()) {
      captureMessage('ai_empty_response', {
        route: 'lib/ai-logic.generatePitch',
        errorCode: aiResult.ok ? null : aiResult.errorCode,
      })
      return `Hi ${ceoName || 'there'}, I put together a sourced competitive intelligence report for ${companyName} based on your recent ${triggerEvent}.\n\n${COMPETITIVE_REPORT_CTA}`
    }

    return normalizePitchText(aiResult.text)
  } catch (error) {
    captureException(error, { route: 'lib/ai-logic.generatePitch' })
    return `Hi ${ceoName || 'there'}, I put together a sourced competitive intelligence report for ${companyName} based on your recent ${triggerEvent}.\n\n${COMPETITIVE_REPORT_CTA}`
  }
}

/**
 * Generate Battle Card - 3-point competitive intelligence.
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
  if (isE2E() || isTestEnv()) {
    return {
      currentTech: ['CRM Platform', 'Email Marketing', 'Analytics Tools'],
      painPoint: 'Scaling sales operations while maintaining quality',
      killerFeature: 'Automated lead scoring and personalized outreach',
    }
  }

  try {
    const aiResult = await generateWithProviderRouter({
      task: 'account_research_summary',
      system: `You are a competitive intelligence analyst. Create a 3-point battle card:
1. Likely Current Tech: List 3-4 technologies/tools they likely use (based on company size, industry, recent events)
2. Pain Point: Identify their main challenge based on trigger events and industry trends
3. Killer Feature: Suggest the one feature from our solution that would solve their pain point

Return strict JSON.`,
      prompt: `Create a battle card for ${companyName}.

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
      temperature: 0.7,
      maxTokens: 400,
      metadata: { route: '/lib/ai-logic.generateBattleCard' },
    })

    if (!aiResult.ok) {
      return {
        currentTech: ['CRM Platform', 'Email Marketing', 'Analytics Tools'],
        painPoint: 'Scaling sales operations while maintaining quality',
        killerFeature: 'Automated lead scoring and personalized outreach',
      }
    }

    const parsed = JSON.parse(aiResult.text) as {
      currentTech?: unknown
      painPoint?: unknown
      killerFeature?: unknown
    }
    const tech =
      typeof parsed.currentTech === 'string'
        ? parsed.currentTech.split(',').map((item) => item.trim())
        : Array.isArray(parsed.currentTech)
          ? parsed.currentTech
              .map((item) => (typeof item === 'string' ? item.trim() : ''))
              .filter((item) => item.length > 0)
          : []

    return {
      currentTech: tech,
      painPoint:
        typeof parsed.painPoint === 'string'
          ? parsed.painPoint
          : 'Growth challenges requiring scalable solutions',
      killerFeature:
        typeof parsed.killerFeature === 'string'
          ? parsed.killerFeature
          : 'AI-powered lead intelligence',
    }
  } catch (error) {
    captureException(error, { route: 'lib/ai-logic.generateBattleCard' })
    return {
      currentTech: ['CRM Platform', 'Email Marketing', 'Analytics Tools'],
      painPoint: 'Scaling sales operations while maintaining quality',
      killerFeature: 'Automated lead scoring and personalized outreach',
    }
  }
}

/**
 * Generate 3-Part Email Sequence.
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
  if (isE2E() || isTestEnv()) {
    return {
      part1: `Hi ${ceoName || 'there'}, I noticed ${companyName} recently ${triggerEvent || 'had some activity'}. I've prepared a competitive intelligence report that might be valuable.`,
      part2: `Based on your recent ${triggerEvent || 'activity'}, companies in your position typically see 40% faster growth when leveraging AI-powered lead intelligence.\n\n${COMPETITIVE_REPORT_CTA}`,
      part3: `Final reminder: Your competitive intelligence report for ${companyName} is ready.\n\n${COMPETITIVE_REPORT_CTA}`,
    }
  }

  const fallback: EmailSequence = {
    part1: `Hi ${ceoName || 'there'}, I've created a competitive intelligence report for ${companyName} based on your recent ${triggerEvent}.\n\n${COMPETITIVE_REPORT_CTA}`,
    part2: `Based on your recent ${triggerEvent}, companies in your position typically see 40% faster growth when leveraging AI-powered lead intelligence.\n\n${COMPETITIVE_REPORT_CTA}`,
    part3: `Final reminder: Your competitive intelligence report for ${companyName} is ready.\n\n${COMPETITIVE_REPORT_CTA}`,
  }

  const prompts = [
    {
      key: 'part1' as const,
      system: `You are a helpful consultant. Write the FIRST email in a 3-part sequence.
Tone: Helpful, warm, value-first
Length: 2-3 sentences
Goal: Provide genuine value and introduce yourself
NEVER mention calls or meetings
Always end with link to ${COMPETITIVE_REPORT_URL}`,
      prompt: `Write Email 1 (Helpful tone) to ${ceoName || 'the leadership team'} of ${companyName}.
Reference: ${triggerEvent || 'their recent growth'}
${userSettings?.whatYouSell ? `Context: We offer ${userSettings.whatYouSell}` : ''}`,
      fallback: fallback.part1,
    },
    {
      key: 'part2' as const,
      system: `You are a data analyst. Write the SECOND email in a 3-part sequence.
Tone: Data-driven, analytical, specific
Length: 3-4 sentences
Goal: Show concrete insights and metrics
Include numbers, percentages, or specific data points
NEVER mention calls or meetings
Always end with link to ${COMPETITIVE_REPORT_URL}`,
      prompt: `Write Email 2 (Data-driven tone) to ${ceoName || 'the leadership team'} of ${companyName}.
Reference: ${triggerEvent || 'their recent growth'}
${companyInfo ? `Company Info: ${companyInfo}` : ''}
${userSettings?.whatYouSell ? `Context: We offer ${userSettings.whatYouSell}` : ''}`,
      fallback: fallback.part2,
    },
    {
      key: 'part3' as const,
      system: `You are a respectful closer. Write the THIRD email in a 3-part sequence.
Tone: Brief, respectful, final follow-up
Length: 1-2 sentences MAX
Goal: One final reminder without being pushy
NEVER mention calls or meetings
Always end with link to ${COMPETITIVE_REPORT_URL}`,
      prompt: `Write Email 3 (Final follow-up, SHORT) to ${ceoName || 'the leadership team'} of ${companyName}.
This is the final email in the sequence. Keep it brief and respectful.`,
      fallback: fallback.part3,
    },
  ]

  try {
    const generated = await Promise.all(
      prompts.map(async (item) => {
        const aiResult = await generateWithProviderRouter({
          task: 'outreach_draft',
          system: item.system,
          prompt: item.prompt,
          temperature: item.key === 'part1' ? 0.8 : item.key === 'part2' ? 0.7 : 0.6,
          maxTokens: item.key === 'part2' ? 200 : item.key === 'part1' ? 150 : 100,
          metadata: { route: '/lib/ai-logic.generateEmailSequence', part: item.key },
        })
        return {
          key: item.key,
          text: aiResult.ok && aiResult.text.trim() ? aiResult.text.trim() : item.fallback,
        }
      })
    )

    const map = new Map(generated.map((entry) => [entry.key, entry.text]))
    return {
      part1: map.get('part1') ?? fallback.part1,
      part2: map.get('part2') ?? fallback.part2,
      part3: map.get('part3') ?? fallback.part3,
    }
  } catch (error) {
    captureException(error, { route: 'lib/ai-logic.generateEmailSequence' })
    return fallback
  }
}
