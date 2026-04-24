import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { getUserTierForGating } from '@/lib/team/gating'
import { getProductPlanDetailsForTier } from '@/lib/billing/product-plan'
import { makeNameCompanyKey } from '@/lib/company-key'
import { logger } from '@/lib/observability/logger'
import {
  LeadGenerationRequestSchema,
  type LeadGenerationRequest,
  type GeneratedLeadCandidate,
  deduplicateLeadCandidates,
  generateSearchStrategyAndCandidates,
  normalizeCompanyName,
  normalizeDomain,
  normalizeEmail,
  scoreLeadFit,
} from '@/lib/services/lead-generation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ExistingLeadRow = {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
  prospect_email: string | null
  ai_personalized_pitch: string | null
  created_at: string | null
}

type DiscoverLeadResponseRow = {
  id: string
  companyName: string
  companyDomain: string | null
  companyUrl: string | null
  contactEmail: string | null
  fitScore: number
  fitExplanation: string
  createdAt: string
}

const ListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  minScore: z
    .preprocess(
      (value) => (typeof value === 'string' && value.trim().length > 0 ? Number.parseInt(value, 10) : undefined),
      z.number().int().min(0).max(100).optional()
    )
    .optional(),
})

const DeleteBodySchema = z.object({
  leadId: z.string().uuid('Invalid lead id'),
})

function buildLeadDraft(args: {
  input: LeadGenerationRequest
  candidate: GeneratedLeadCandidate
  score: { score: number; explanation: string }
}): string {
  return [
    `[LeadIntel Fit ${args.score.score}/100] ${args.score.explanation}`,
    `Target role: ${args.candidate.targetRole ?? args.input.targetRole}`,
    `Pain point focus: ${args.input.painPoint}`,
    `Offer/service: ${args.input.offerService}`,
    `Industry: ${args.candidate.industry ?? args.input.targetIndustry}`,
    `Location: ${args.candidate.location ?? args.input.location}`,
    `Company size: ${args.candidate.companySize ?? args.input.companySize}`,
  ].join('\n')
}

function parseDraftScore(draft: string | null): { score: number; explanation: string } | null {
  if (typeof draft !== 'string') return null
  const firstLine = draft.split('\n')[0] ?? ''
  const matched = firstLine.match(/^\[LeadIntel Fit (\d{1,3})\/100\]\s*(.+)$/)
  if (!matched) return null
  const score = Number.parseInt(matched[1], 10)
  if (!Number.isFinite(score)) return null
  return {
    score: Math.max(0, Math.min(100, score)),
    explanation: matched[2].trim(),
  }
}

async function getExistingLeadsForUser(supabase: ReturnType<typeof createRouteClient>, userId: string): Promise<ExistingLeadRow[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('id, company_name, company_domain, company_url, prospect_email, ai_personalized_pitch, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) throw error
  return (data ?? []) as ExistingLeadRow[]
}

function buildExistingMaps(rows: ExistingLeadRow[]): {
  byDomain: Map<string, ExistingLeadRow>
  byEmail: Map<string, ExistingLeadRow>
  byCompany: Map<string, ExistingLeadRow>
} {
  const byDomain = new Map<string, ExistingLeadRow>()
  const byEmail = new Map<string, ExistingLeadRow>()
  const byCompany = new Map<string, ExistingLeadRow>()

  for (const row of rows) {
    const domainKey = normalizeDomain(row.company_domain ?? row.company_url)
    const emailKey = normalizeEmail(row.prospect_email)
    const companyKey = normalizeCompanyName(row.company_name)

    if (domainKey && !byDomain.has(domainKey)) byDomain.set(domainKey, row)
    if (emailKey && !byEmail.has(emailKey)) byEmail.set(emailKey, row)
    if (companyKey && !byCompany.has(companyKey)) byCompany.set(companyKey, row)
  }

  return { byDomain, byEmail, byCompany }
}

function findDuplicate(existing: ReturnType<typeof buildExistingMaps>, candidate: GeneratedLeadCandidate): ExistingLeadRow | null {
  const domainKey = normalizeDomain(candidate.companyDomain ?? candidate.companyUrl)
  if (domainKey && existing.byDomain.has(domainKey)) return existing.byDomain.get(domainKey) ?? null

  const emailKey = normalizeEmail(candidate.contactEmail)
  if (emailKey && existing.byEmail.has(emailKey)) return existing.byEmail.get(emailKey) ?? null

  const companyKey = normalizeCompanyName(candidate.companyName)
  if (companyKey && existing.byCompany.has(companyKey)) return existing.byCompany.get(companyKey) ?? null

  return null
}

async function mergeDuplicateLead(args: {
  supabase: ReturnType<typeof createRouteClient>
  userId: string
  existing: ExistingLeadRow
  candidate: GeneratedLeadCandidate
  draft: string
}): Promise<boolean> {
  const updates: Record<string, string> = {}
  if ((!args.existing.prospect_email || args.existing.prospect_email.trim().length === 0) && args.candidate.contactEmail) {
    updates.prospect_email = args.candidate.contactEmail
  }
  if ((!args.existing.company_url || args.existing.company_url.trim().length === 0) && args.candidate.companyUrl) {
    updates.company_url = args.candidate.companyUrl
  }
  if ((!args.existing.ai_personalized_pitch || args.existing.ai_personalized_pitch.trim().length === 0) && args.draft.trim().length > 0) {
    updates.ai_personalized_pitch = args.draft
  }

  if (Object.keys(updates).length === 0) return false

  const { error } = await args.supabase
    .from('leads')
    .update(updates)
    .eq('id', args.existing.id)
    .eq('user_id', args.userId)

  return !error
}

async function enrichCandidatesWithProviders(candidates: GeneratedLeadCandidate[]): Promise<{
  candidates: GeneratedLeadCandidate[]
  provider: 'clearbit' | null
  enrichedCount: number
}> {
  const clearbitKey = (process.env.CLEARBIT_API_KEY ?? '').trim()
  if (!clearbitKey) {
    return { candidates, provider: null, enrichedCount: 0 }
  }

  let enrichedCount = 0
  const enriched = await Promise.all(
    candidates.map(async (candidate, index) => {
      if (index >= 10) return candidate
      const domain = normalizeDomain(candidate.companyDomain ?? candidate.companyUrl)
      if (!domain) return candidate

      try {
        const response = await fetch(`https://company.clearbit.com/v2/companies/find?domain=${domain}`, {
          headers: {
            Authorization: `Bearer ${clearbitKey}`,
          },
        })
        if (!response.ok) return candidate

        const payload = (await response.json()) as {
          category?: { industry?: string | null }
          metrics?: { employeesRange?: string | null }
        }

        enrichedCount += 1
        return {
          ...candidate,
          industry: candidate.industry ?? payload.category?.industry ?? null,
          companySize: candidate.companySize ?? payload.metrics?.employeesRange ?? null,
          fitNotes: [
            ...(candidate.fitNotes ?? []),
            ...(payload.category?.industry ? [`Clearbit industry: ${payload.category.industry}`] : []),
          ].slice(0, 6),
        }
      } catch {
        return candidate
      }
    })
  )

  return { candidates: enriched, provider: 'clearbit', enrichedCount }
}

const GET_HANDLER = withApiGuard(
  async (request: NextRequest, { requestId, query }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const parsedQuery = (query ?? {}) as z.infer<typeof ListQuerySchema>
      const search = parsedQuery.q?.toLowerCase() ?? ''
      const minScore = parsedQuery.minScore ?? 0

      const existingRows = await getExistingLeadsForUser(supabase, user.id)
      const mapped: DiscoverLeadResponseRow[] = existingRows
        .map((row) => {
          const parsedScore = parseDraftScore(row.ai_personalized_pitch)
          return {
            id: row.id,
            companyName: row.company_name ?? 'Unknown company',
            companyDomain: row.company_domain ?? null,
            companyUrl: row.company_url ?? null,
            contactEmail: row.prospect_email ?? null,
            fitScore: parsedScore?.score ?? 0,
            fitExplanation: parsedScore?.explanation ?? 'No AI fit explanation available yet.',
            createdAt: row.created_at ?? new Date().toISOString(),
          }
        })
        .filter((row) => {
          const matchesQuery = search.length === 0
            || row.companyName.toLowerCase().includes(search)
            || (row.companyDomain ?? '').toLowerCase().includes(search)
            || (row.contactEmail ?? '').toLowerCase().includes(search)
          return matchesQuery && row.fitScore >= minScore
        })

      return ok({ leads: mapped }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/leads/discover', undefined, bridge, requestId)
    }
  },
  { querySchema: ListQuerySchema }
)

const POST_HANDLER = withApiGuard(
  async (request: NextRequest, { requestId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const parsedBody = body as LeadGenerationRequest

      const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      const planDetails = getProductPlanDetailsForTier(tier)
      const existingRows = await getExistingLeadsForUser(supabase, user.id)
      const currentLeadCount = existingRows.length

      const leadLimit = planDetails.leadGenerationLimit
      const remainingByPlanLimit = typeof leadLimit === 'number' ? Math.max(0, leadLimit - currentLeadCount) : null
      if (typeof remainingByPlanLimit === 'number' && remainingByPlanLimit <= 0) {
        return fail(
          'LEAD_GENERATION_LIMIT_REACHED',
          `${planDetails.label} lead generation limit reached. Upgrade to generate more leads.`,
          { tier, productPlan: planDetails.plan, limit: leadLimit, used: currentLeadCount, remaining: 0 },
          { status: 429 },
          bridge,
          requestId
        )
      }

      const requested = parsedBody.numberOfLeads
      const maxInsertable =
        typeof remainingByPlanLimit === 'number' ? Math.min(requested, remainingByPlanLimit) : requested
      const effectiveInput: LeadGenerationRequest = {
        ...parsedBody,
        numberOfLeads: maxInsertable,
      }

      const generated = await generateSearchStrategyAndCandidates(effectiveInput)
      const generatedCandidates = generated.candidates.map((candidate) => ({
        ...candidate,
        fitNotes: [
          ...(candidate.fitNotes ?? []),
          `Lead strategy: ${generated.strategy.query}`,
          `Pain point focus: ${parsedBody.painPoint}`,
          `Offer fit: ${parsedBody.offerService}`,
        ].slice(0, 6),
      }))
      const enriched = await enrichCandidatesWithProviders(generatedCandidates)
      const { deduped: dedupedCandidates, duplicatesRemoved } = deduplicateLeadCandidates(enriched.candidates)

      const existingMaps = buildExistingMaps(existingRows)
      const candidatesToInsert: Array<{
        candidate: GeneratedLeadCandidate
        score: ReturnType<typeof scoreLeadFit>
        draft: string
      }> = []
      let duplicatesAgainstExisting = 0
      let mergedDuplicates = 0

      for (const candidate of dedupedCandidates) {
        if (candidatesToInsert.length >= maxInsertable) break
        const duplicate = findDuplicate(existingMaps, candidate)
        const score = scoreLeadFit(parsedBody, candidate)
        const draft = buildLeadDraft({ input: parsedBody, candidate, score })

        if (duplicate) {
          duplicatesAgainstExisting += 1
          const merged = await mergeDuplicateLead({
            supabase,
            userId: user.id,
            existing: duplicate,
            candidate,
            draft,
          })
          if (merged) mergedDuplicates += 1
          continue
        }

        candidatesToInsert.push({ candidate, score, draft })
      }

      const rowsToInsert = candidatesToInsert.map((entry) => {
        const domain = normalizeDomain(entry.candidate.companyDomain ?? entry.candidate.companyUrl)
        return {
          user_id: user.id,
          company_name: entry.candidate.companyName,
          company_domain: domain ?? makeNameCompanyKey(entry.candidate.companyName),
          company_url: entry.candidate.companyUrl ?? null,
          prospect_email: entry.candidate.contactEmail ?? null,
          ai_personalized_pitch: entry.draft,
        }
      })

      let insertedRows: ExistingLeadRow[] = []
      if (rowsToInsert.length > 0) {
        const { data: insertedData, error: insertError } = await supabase
          .from('leads')
          .upsert(rowsToInsert, { onConflict: 'user_id,company_domain' })
          .select('id, company_name, company_domain, company_url, prospect_email, ai_personalized_pitch, created_at')

        if (insertError) {
          logger.error({
            scope: 'lead-generation',
            message: 'insert_failed',
            requestId,
            code: insertError.code,
          })
          return fail(ErrorCode.DATABASE_ERROR, 'Failed to save generated leads', undefined, undefined, bridge, requestId)
        }
        insertedRows = (insertedData ?? []) as ExistingLeadRow[]
      }

      const insertedResponseRows: DiscoverLeadResponseRow[] = insertedRows.map((row) => {
        const parsedScore = parseDraftScore(row.ai_personalized_pitch)
        return {
          id: row.id,
          companyName: row.company_name ?? 'Unknown company',
          companyDomain: row.company_domain ?? null,
          companyUrl: row.company_url ?? null,
          contactEmail: row.prospect_email ?? null,
          fitScore: parsedScore?.score ?? 0,
          fitExplanation: parsedScore?.explanation ?? 'No fit explanation available.',
          createdAt: row.created_at ?? new Date().toISOString(),
        }
      })

      const usageUsed = currentLeadCount + insertedResponseRows.length
      const usageLimit = leadLimit
      const usageRemaining = typeof usageLimit === 'number' ? Math.max(0, usageLimit - usageUsed) : null

      return ok(
        {
          strategy: generated.strategy,
          leads: insertedResponseRows,
          usage: {
            tier,
            productPlan: planDetails.plan,
            used: usageUsed,
            limit: usageLimit,
            remaining: usageRemaining,
          },
          generation: {
            requested,
            attempted: dedupedCandidates.length,
            inserted: insertedResponseRows.length,
            duplicatesRemoved,
            duplicatesAgainstExisting,
            mergedDuplicates,
            source: generated.source,
            warning: generated.warning,
          },
          enrichment: {
            provider: enriched.provider,
            enabled: enriched.provider !== null,
            enrichedCount: enriched.enrichedCount,
          },
        },
        { status: 201 },
        bridge,
        requestId
      )
    } catch (error) {
      return asHttpError(error, '/api/leads/discover', undefined, bridge, requestId)
    }
  },
  { bodySchema: LeadGenerationRequestSchema }
)

const DELETE_HANDLER = withApiGuard(
  async (request: NextRequest, { requestId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const parsedBody = body as z.infer<typeof DeleteBodySchema>

      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', parsedBody.leadId)
        .eq('user_id', user.id)

      if (error) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to delete lead', undefined, undefined, bridge, requestId)
      }

      return ok({ deleted: true }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/leads/discover', undefined, bridge, requestId)
    }
  },
  { bodySchema: DeleteBodySchema }
)

export const GET = async (request: NextRequest) => GET_HANDLER(request)
export const POST = async (request: NextRequest) => POST_HANDLER(request)
export const DELETE = async (request: NextRequest) => DELETE_HANDLER(request)

