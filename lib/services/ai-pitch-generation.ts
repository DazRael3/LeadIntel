import { z } from 'zod'
import { generateWithProviderRouter } from '@/lib/ai/providerRouter'

const AI_PITCH_PROMPT_VERSION = 'v1'

const AI_PITCH_PRICING_USD_PER_MILLION_TOKENS = {
  input: 0.15,
  output: 0.6,
} as const

const GENERATION_SYSTEM_PROMPT = [
  'You are a B2B sales messaging assistant for a SaaS product.',
  'Return strict JSON only.',
  'Never fabricate facts, customer results, or prior relationships.',
  'Never use spammy or deceptive language, false urgency, or guaranteed outcomes.',
  'Write concise, practical messaging that is specific to the provided lead context.',
].join(' ')

export const AiPitchPromptInputSchema = z.object({
  painPoint: z.string().trim().min(4).max(240).optional(),
  offerService: z.string().trim().min(4).max(240).optional(),
  campaignObjective: z.string().trim().min(4).max(240).optional(),
  callToAction: z.string().trim().min(4).max(160).optional(),
  improveContext: z.string().trim().min(4).max(320).optional(),
  regenerate: z.boolean().optional(),
})

export type AiPitchPromptInput = z.infer<typeof AiPitchPromptInputSchema>

export const AiPitchOutputsSchema = z.object({
  shortEmailOpener: z.string().trim().min(20).max(500),
  fullColdEmail: z.string().trim().min(80).max(3000),
  linkedinDm: z.string().trim().min(20).max(1200),
  painPointSummary: z.string().trim().min(20).max(800),
  recommendedOfferAngle: z.string().trim().min(20).max(800),
  objectionHandlingNotes: z.string().trim().min(30).max(1200),
})

export type AiPitchOutputs = z.infer<typeof AiPitchOutputsSchema>

type GenerateLeadPitchBundleArgs = {
  companyName: string | null
  companyDomain: string | null
  companyUrl: string | null
  existingPitchDraft: string | null
  iterationHistory?: AiPitchOutputs[]
  promptInput: AiPitchPromptInput
}

type GenerateLeadPitchBundleResult = {
  model: string
  promptVersion: string
  outputs: AiPitchOutputs
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUsd: number
}

function extractCompletionText(
  content: string | Array<{ text?: string; type?: string }> | null | undefined
): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim()
}

function softenRiskyLanguage(value: string): string {
  return value
    .replace(/\bguarantee(?:d|s)?\b/gi, 'aim')
    .replace(/\b100%\b/g, 'high')
    .replace(/\brisk[-\s]?free\b/gi, 'low-risk')
    .replace(/\bno[-\s]?brainer\b/gi, 'practical option')
}

function enforceSafetyPolicy(outputs: AiPitchOutputs): AiPitchOutputs {
  return {
    shortEmailOpener: softenRiskyLanguage(outputs.shortEmailOpener),
    fullColdEmail: softenRiskyLanguage(outputs.fullColdEmail),
    linkedinDm: softenRiskyLanguage(outputs.linkedinDm),
    painPointSummary: softenRiskyLanguage(outputs.painPointSummary),
    recommendedOfferAngle: softenRiskyLanguage(outputs.recommendedOfferAngle),
    objectionHandlingNotes: softenRiskyLanguage(outputs.objectionHandlingNotes),
  }
}

function toUsd6(value: number): number {
  return Number(value.toFixed(6))
}

export function estimateTokenCostUsd(args: { promptTokens: number; completionTokens: number }): number {
  const safePromptTokens = Number.isFinite(args.promptTokens) ? Math.max(0, args.promptTokens) : 0
  const safeCompletionTokens = Number.isFinite(args.completionTokens) ? Math.max(0, args.completionTokens) : 0
  const inputCost = (safePromptTokens / 1_000_000) * AI_PITCH_PRICING_USD_PER_MILLION_TOKENS.input
  const outputCost = (safeCompletionTokens / 1_000_000) * AI_PITCH_PRICING_USD_PER_MILLION_TOKENS.output
  return toUsd6(inputCost + outputCost)
}

function buildUserPrompt(args: GenerateLeadPitchBundleArgs): string {
  const contextLines = [
    `Company name: ${args.companyName ?? 'Unknown company'}`,
    `Company domain: ${args.companyDomain ?? 'Unknown domain'}`,
    `Company URL: ${args.companyUrl ?? 'Unknown URL'}`,
    `Existing draft: ${args.existingPitchDraft ?? 'None'}`,
    `Pain point focus: ${args.promptInput.painPoint ?? 'Use lead context only'}`,
    `Offer/service focus: ${args.promptInput.offerService ?? 'Use lead context only'}`,
    `Campaign objective: ${args.promptInput.campaignObjective ?? 'Book a relevant follow-up conversation'}`,
    `Preferred CTA: ${args.promptInput.callToAction ?? 'Ask one low-friction, specific next step'}`,
    `Improve context: ${args.promptInput.improveContext ?? 'None provided'}`,
  ]
  const historyLines =
    args.iterationHistory && args.iterationHistory.length > 0
      ? args.iterationHistory
          .slice(-3)
          .map(
            (entry, index) =>
              `History ${index + 1}: opener="${entry.shortEmailOpener}" | dm="${entry.linkedinDm}"`
          )
      : ['History: none']

  return [
    'Generate outreach content for one lead and return strict JSON.',
    'JSON keys required:',
    'shortEmailOpener, fullColdEmail, linkedinDm, painPointSummary, recommendedOfferAngle, objectionHandlingNotes',
    'Constraints:',
    '- Keep claims honest and verifiable from provided context.',
    '- No fake urgency, no fake social proof, no fabricated results.',
    '- Tone should be helpful, direct, and non-spammy.',
    '- objectionHandlingNotes should be concise actionable notes (single paragraph).',
    '- When history is provided, improve clarity and specificity while avoiding repetition.',
    '',
    ...contextLines,
    ...historyLines,
  ].join('\n')
}

function buildDeterministicPitchOutputs(args: {
  companyName: string | null
  promptInput: AiPitchPromptInput
}): AiPitchOutputs {
  const company = args.companyName?.trim() || 'the account'
  const painPoint = args.promptInput.painPoint?.trim() || 'slow response times and inconsistent lead prioritization'
  const offer = args.promptInput.offerService?.trim() || 'a focused workflow that improves lead qualification and follow-through'
  const objective =
    args.promptInput.campaignObjective?.trim() || 'book a short discovery follow-up tied to a measurable outcome'
  const cta = args.promptInput.callToAction?.trim() || 'Would a short working session next week be useful?'

  return {
    shortEmailOpener: `Quick note on ${company}: teams often lose momentum when ${painPoint}.`,
    fullColdEmail: `Hi team,\n\nI reviewed ${company} and noticed a likely friction point around ${painPoint}. We help revenue teams tighten this by using ${offer}, which keeps outreach focused on high-intent opportunities and clearer next steps.\n\nIf the priority is ${objective}, we can start with one narrow pilot and define success metrics before expanding.\n\n${cta}`,
    linkedinDm: `Noticed activity around ${company}. If ${painPoint} is on your radar, I can share a practical outline using ${offer} to improve execution without adding heavy process.`,
    painPointSummary: `${company} likely faces execution drag from ${painPoint}, which can slow pipeline progression and reduce message relevance.`,
    recommendedOfferAngle: `Position ${offer} as a low-risk first step that supports ${objective} and creates a measurable baseline.`,
    objectionHandlingNotes: `If timing is a concern, acknowledge current priorities, narrow scope to one high-value workflow, and confirm a concrete success criterion before asking for broader adoption.`,
  }
}

export async function generateLeadPitchBundle(
  args: GenerateLeadPitchBundleArgs
): Promise<GenerateLeadPitchBundleResult> {
  const promptInput = AiPitchPromptInputSchema.parse(args.promptInput)
  const prompt = buildUserPrompt({ ...args, promptInput })
  const aiResult = await generateWithProviderRouter({
    task: 'outreach_draft',
    system: GENERATION_SYSTEM_PROMPT,
    prompt,
    temperature: 0.3,
    maxTokens: 1200,
    metadata: {
      route: '/lib/services/ai-pitch-generation',
      companyDomain: args.companyDomain,
    },
  })

  let outputs: AiPitchOutputs
  if (aiResult.ok) {
    try {
      const rawContent = extractCompletionText(aiResult.text)
      const parsed = JSON.parse(rawContent) as unknown
      outputs = enforceSafetyPolicy(AiPitchOutputsSchema.parse(parsed))
    } catch {
      outputs = enforceSafetyPolicy(
        buildDeterministicPitchOutputs({
          companyName: args.companyName,
          promptInput,
        })
      )
    }
  } else {
    outputs = enforceSafetyPolicy(
      buildDeterministicPitchOutputs({
        companyName: args.companyName,
        promptInput,
      })
    )
  }

  const promptTokens = aiResult.ok ? aiResult.usage?.promptTokens ?? 0 : 0
  const completionTokens = aiResult.ok ? aiResult.usage?.completionTokens ?? 0 : 0
  const totalTokens =
    aiResult.ok ? aiResult.usage?.totalTokens ?? promptTokens + completionTokens : 0

  return {
    model: aiResult.ok ? aiResult.model : 'deterministic-template-v1',
    promptVersion: AI_PITCH_PROMPT_VERSION,
    outputs,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: aiResult.ok
      ? estimateTokenCostUsd({ promptTokens, completionTokens })
      : 0,
  }
}
