import { z } from 'zod'
import OpenAI from 'openai'
import { serverEnv } from '@/lib/env'

export const LeadGenerationRequestSchema = z.object({
  targetIndustry: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(120),
  companySize: z.string().trim().min(2).max(80),
  targetRole: z.string().trim().min(2).max(120),
  painPoint: z.string().trim().min(4).max(240),
  offerService: z.string().trim().min(4).max(240),
  numberOfLeads: z.number().int().min(1).max(50),
})

export type LeadGenerationRequest = z.infer<typeof LeadGenerationRequestSchema>

export const LeadSearchPayloadSchema = LeadGenerationRequestSchema.extend({
  savedSearchId: z.string().uuid().optional(),
})

export type LeadSearchPayload = z.infer<typeof LeadSearchPayloadSchema>

export const GeneratedLeadCandidateSchema = z.object({
  companyName: z.string().trim().min(1).max(160),
  companyDomain: z.string().trim().min(1).max(255).nullable().optional(),
  companyUrl: z.string().trim().url().nullable().optional(),
  contactEmail: z.string().trim().email().nullable().optional(),
  targetRole: z.string().trim().max(120).nullable().optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  companySize: z.string().trim().max(80).nullable().optional(),
  fitNotes: z.array(z.string().trim().min(1).max(160)).max(6).optional(),
})

export type GeneratedLeadCandidate = z.infer<typeof GeneratedLeadCandidateSchema>

export type LeadFitScore = {
  score: number
  reasons: string[]
  explanation: string
}

export type LeadSearchStrategy = {
  query: string
  rationale: string
  channels: string[]
  enrichmentNotes: string
}

const LeadSearchStrategySchema = z.object({
  query: z.string().trim().min(1).max(500),
  rationale: z.string().trim().min(1).max(700),
  channels: z.array(z.string().trim().min(1).max(60)).max(6),
  enrichmentNotes: z.string().trim().min(1).max(500),
})

const LeadGenerationModelOutputSchema = z.object({
  strategy: LeadSearchStrategySchema,
  leads: z.array(GeneratedLeadCandidateSchema).max(80),
})

export type LeadGenerationModelOutput = z.infer<typeof LeadGenerationModelOutputSchema>

function clampScore(value: number): number {
  const bounded = Math.max(0, Math.min(100, Math.round(value)))
  return Number.isFinite(bounded) ? bounded : 0
}

export function normalizeDomain(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  const withoutProtocol = trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '')
  const domain = withoutProtocol.split('/')[0]
  if (!domain.includes('.')) return null
  return domain
}

export function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!email || !email.includes('@')) return null
  return email
}

export function normalizeCompanyName(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return normalized.length > 0 ? normalized : null
}

export function deduplicateLeadCandidates(candidates: GeneratedLeadCandidate[]): {
  deduped: GeneratedLeadCandidate[]
  duplicatesRemoved: number
} {
  const deduped = new Map<string, GeneratedLeadCandidate>()
  const keyToId = new Map<string, string>()
  let duplicatesRemoved = 0

  const toCandidateKeys = (candidate: GeneratedLeadCandidate): string[] => {
    const keys: string[] = []
    const domainKey = normalizeDomain(candidate.companyDomain ?? candidate.companyUrl ?? null)
    const emailKey = normalizeEmail(candidate.contactEmail ?? null)
    const companyKey = normalizeCompanyName(candidate.companyName)
    if (domainKey) keys.push(`domain:${domainKey}`)
    if (emailKey) keys.push(`email:${emailKey}`)
    if (companyKey) keys.push(`company:${companyKey}`)
    return keys
  }

  for (const candidate of candidates) {
    const keys = toCandidateKeys(candidate)
    if (keys.length === 0) continue

    const matchedId = keys.find((key) => keyToId.has(key))
    if (!matchedId) {
      const canonicalId = `candidate-${deduped.size + 1}`
      deduped.set(canonicalId, candidate)
      for (const key of keys) {
        keyToId.set(key, canonicalId)
      }
      continue
    }

    const canonicalId = keyToId.get(matchedId) ?? null
    if (!canonicalId) continue
    const existing = deduped.get(canonicalId)
    if (!existing) continue

    duplicatesRemoved += 1
    const merged = mergeCandidates(existing, candidate)
    deduped.set(canonicalId, merged)
    const mergedKeys = toCandidateKeys(merged)
    for (const key of mergedKeys) {
      keyToId.set(key, canonicalId)
    }
  }

  return { deduped: Array.from(deduped.values()), duplicatesRemoved }
}

function mergeCandidates(base: GeneratedLeadCandidate, incoming: GeneratedLeadCandidate): GeneratedLeadCandidate {
  const mergedNotes = new Set<string>([...(base.fitNotes ?? []), ...(incoming.fitNotes ?? [])])
  return {
    companyName: chooseRicherString(base.companyName, incoming.companyName) ?? base.companyName,
    companyDomain: chooseRicherString(base.companyDomain ?? null, incoming.companyDomain ?? null),
    companyUrl: chooseRicherString(base.companyUrl ?? null, incoming.companyUrl ?? null),
    contactEmail: chooseRicherString(base.contactEmail ?? null, incoming.contactEmail ?? null),
    targetRole: chooseRicherString(base.targetRole ?? null, incoming.targetRole ?? null),
    industry: chooseRicherString(base.industry ?? null, incoming.industry ?? null),
    location: chooseRicherString(base.location ?? null, incoming.location ?? null),
    companySize: chooseRicherString(base.companySize ?? null, incoming.companySize ?? null),
    fitNotes: Array.from(mergedNotes).slice(0, 6),
  }
}

function chooseRicherString(a: string | null, b: string | null): string | null {
  const left = typeof a === 'string' ? a.trim() : ''
  const right = typeof b === 'string' ? b.trim() : ''
  if (!left && !right) return null
  if (!left) return right
  if (!right) return left
  return right.length > left.length ? right : left
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase()
}

function textContains(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false
  const source = normalizeToken(haystack)
  const target = normalizeToken(needle)
  return source.includes(target)
}

function scoreAlignment(candidateValue: string | null | undefined, requestedValue: string, maxPoints: number): number {
  if (textContains(candidateValue, requestedValue)) return maxPoints
  return 0
}

export function scoreLeadFit(
  request: LeadGenerationRequest,
  candidate: GeneratedLeadCandidate
): LeadFitScore {
  const reasons: string[] = []
  let score = 35

  const industryPoints = scoreAlignment(candidate.industry, request.targetIndustry, 20)
  if (industryPoints > 0) reasons.push(`Industry aligns with ${request.targetIndustry}`)
  score += industryPoints

  const locationPoints = scoreAlignment(candidate.location, request.location, 15)
  if (locationPoints > 0) reasons.push(`Location aligns with ${request.location}`)
  score += locationPoints

  const sizePoints = scoreAlignment(candidate.companySize, request.companySize, 15)
  if (sizePoints > 0) reasons.push(`Company size aligns with ${request.companySize}`)
  score += sizePoints

  const rolePoints = scoreAlignment(candidate.targetRole, request.targetRole, 20)
  if (rolePoints > 0) reasons.push(`Target role matches ${request.targetRole}`)
  score += rolePoints

  const notes = candidate.fitNotes ?? []
  const painPointMatched = notes.some((note) => textContains(note, request.painPoint))
  if (painPointMatched) {
    reasons.push(`Signals mention the pain point: ${request.painPoint}`)
    score += 10
  }

  if (request.offerService.trim().length > 0) {
    reasons.push(`Offer relevance evaluated against: ${request.offerService}`)
    score += 5
  }

  const clamped = clampScore(score)
  const explanation = reasons.length > 0
    ? reasons.join('. ')
    : `Baseline fit based on ${request.targetIndustry} in ${request.location}`

  return {
    score: clamped,
    reasons,
    explanation,
  }
}

function slugifyPart(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function titleCase(input: string): string {
  return input
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function buildFallbackLeadCandidates(input: LeadGenerationRequest): GeneratedLeadCandidate[] {
  const industryPart = slugifyPart(input.targetIndustry) || 'industry'
  const locationPart = slugifyPart(input.location) || 'region'
  const roleEmailPart = slugifyPart(input.targetRole) || 'contact'
  const companyPrefixes = ['Atlas', 'Summit', 'Northstar', 'Vertex', 'Keystone', 'Bluewave', 'Ironclad']

  const output: GeneratedLeadCandidate[] = []
  for (let index = 0; index < input.numberOfLeads; index += 1) {
    const prefix = companyPrefixes[index % companyPrefixes.length]
    const companyName = `${prefix} ${titleCase(input.targetIndustry)} ${index + 1}`
    const domain = `${prefix.toLowerCase()}-${locationPart}-${industryPart}-${index + 1}.example.com`

    output.push({
      companyName,
      companyDomain: domain,
      companyUrl: `https://${domain}`,
      contactEmail: `${roleEmailPart}@${domain}`,
      targetRole: input.targetRole,
      industry: input.targetIndustry,
      location: input.location,
      companySize: input.companySize,
      fitNotes: [
        `Company is hiring for ${input.targetRole}`,
        `Expansion pressure tied to ${input.painPoint}`,
      ],
    })
  }

  return output
}

function buildFallbackStrategy(input: LeadGenerationRequest): LeadSearchStrategy {
  return {
    query: `${input.targetIndustry} companies in ${input.location} with ${input.companySize} teams hiring ${input.targetRole}`,
    rationale: `Prioritizes companies likely to feel "${input.painPoint}" and buy ${input.offerService}.`,
    channels: ['company websites', 'linkedin', 'news mentions'],
    enrichmentNotes: 'Use company domain and role cues, then score against ICP and pain-point alignment.',
  }
}

function getOpenAIClient(): OpenAI | null {
  const key = (serverEnv.OPENAI_API_KEY ?? '').trim()
  if (!key) return null
  return new OpenAI({ apiKey: key })
}

function extractTextFromOpenAiContent(content: string | Array<{ type?: string; text?: string }> | null | undefined): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
    .join('\n')
    .trim()
}

function parseModelOutput(raw: string): LeadGenerationModelOutput | null {
  try {
    const parsedUnknown = JSON.parse(raw) as unknown
    const validated = LeadGenerationModelOutputSchema.safeParse(parsedUnknown)
    if (!validated.success) return null
    return validated.data
  } catch {
    return null
  }
}

function topUpCandidates(input: LeadGenerationRequest, candidates: GeneratedLeadCandidate[]): GeneratedLeadCandidate[] {
  if (candidates.length >= input.numberOfLeads) {
    return candidates.slice(0, input.numberOfLeads)
  }

  const fallbackPool = buildFallbackLeadCandidates(input)
  const combined = [...candidates, ...fallbackPool]
  const { deduped } = deduplicateLeadCandidates(combined)
  return deduped.slice(0, input.numberOfLeads)
}

export async function generateSearchStrategyAndCandidates(input: LeadGenerationRequest): Promise<{
  strategy: LeadSearchStrategy
  candidates: GeneratedLeadCandidate[]
  source: 'openai' | 'fallback'
  warning: string | null
}> {
  const fallbackStrategy = buildFallbackStrategy(input)
  const openai = getOpenAIClient()
  if (!openai) {
    return {
      strategy: fallbackStrategy,
      candidates: buildFallbackLeadCandidates(input).slice(0, input.numberOfLeads),
      source: 'fallback',
      warning: 'openai_not_configured',
    }
  }

  try {
    const prompt = [
      'Generate a B2B lead search plan and lead candidate list as strict JSON.',
      'Return only valid JSON with keys: strategy, leads.',
      'strategy: { query, rationale, channels[], enrichmentNotes }',
      'leads: array of { companyName, companyDomain, companyUrl, contactEmail, targetRole, industry, location, companySize, fitNotes[] }',
      `Need exactly ${input.numberOfLeads} leads.`,
      `Target industry: ${input.targetIndustry}`,
      `Location: ${input.location}`,
      `Company size: ${input.companySize}`,
      `Target role: ${input.targetRole}`,
      `Pain point: ${input.painPoint}`,
      `Offer/service: ${input.offerService}`,
    ].join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a sales ops assistant. Output strict JSON only and never wrap with markdown.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const rawContent = extractTextFromOpenAiContent(completion.choices[0]?.message?.content ?? '')
    const output = parseModelOutput(rawContent)
    if (!output) {
      return {
        strategy: fallbackStrategy,
        candidates: buildFallbackLeadCandidates(input).slice(0, input.numberOfLeads),
        source: 'fallback',
        warning: 'openai_invalid_json',
      }
    }

    const toppedUp = topUpCandidates(input, output.leads)
    return {
      strategy: output.strategy,
      candidates: toppedUp,
      source: 'openai',
      warning: null,
    }
  } catch {
    return {
      strategy: fallbackStrategy,
      candidates: buildFallbackLeadCandidates(input).slice(0, input.numberOfLeads),
      source: 'fallback',
      warning: 'openai_generation_failed',
    }
  }
}

