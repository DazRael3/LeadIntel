import { z } from 'zod'
import OpenAI from 'openai'
import { serverEnv } from '@/lib/env'

const AI_PITCH_MODEL = 'gpt-4o-mini'
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

function getOpenAiClient(): OpenAI {
  const apiKey = (serverEnv.OPENAI_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error('openai_not_configured')
  }
  return new OpenAI({ apiKey })
}

function extractCompletionText(content: string | Array<{ text?: string; type?: string }> | null | undefined): string {
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
  ]

  return [
    'Generate outreach content for one lead and return strict JSON.',
    'JSON keys required:',
    'shortEmailOpener, fullColdEmail, linkedinDm, painPointSummary, recommendedOfferAngle, objectionHandlingNotes',
    'Constraints:',
    '- Keep claims honest and verifiable from provided context.',
    '- No fake urgency, no fake social proof, no fabricated results.',
    '- Tone should be helpful, direct, and non-spammy.',
    '- objectionHandlingNotes should be concise actionable notes (single paragraph).',
    '',
    ...contextLines,
  ].join('\n')
}

export async function generateLeadPitchBundle(args: GenerateLeadPitchBundleArgs): Promise<GenerateLeadPitchBundleResult> {
  const promptInput = AiPitchPromptInputSchema.parse(args.promptInput)
  const openai = getOpenAiClient()

  const completion = await openai.chat.completions.create({
    model: AI_PITCH_MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: GENERATION_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt({ ...args, promptInput }) },
    ],
  })

  const rawContent = extractCompletionText(completion.choices[0]?.message?.content)
  const parsed = JSON.parse(rawContent) as unknown
  const outputs = enforceSafetyPolicy(AiPitchOutputsSchema.parse(parsed))

  const promptTokens = completion.usage?.prompt_tokens ?? 0
  const completionTokens = completion.usage?.completion_tokens ?? 0
  const totalTokens = completion.usage?.total_tokens ?? promptTokens + completionTokens

  return {
    model: AI_PITCH_MODEL,
    promptVersion: AI_PITCH_PROMPT_VERSION,
    outputs,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: estimateTokenCostUsd({ promptTokens, completionTokens }),
  }
}
