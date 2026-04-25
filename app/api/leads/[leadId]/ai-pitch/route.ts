import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserTierForGating } from '@/lib/team/gating'
import { logger } from '@/lib/observability/logger'
import {
  AiPitchOutputsSchema,
  AiPitchPromptInputSchema,
  generateLeadPitchBundle,
} from '@/lib/services/ai-pitch-generation'
import {
  getAiPitchLimitForTier,
  getCurrentMonthlyUsageWindowStart,
  isAiPitchLimitReached,
} from '@/lib/billing/ai-pitch-limits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LeadIdSchema = z.string().uuid('Invalid lead id')

const PostBodySchema = z.object({
  promptInput: AiPitchPromptInputSchema.optional(),
  regenerate: z.boolean().optional(),
})

type LeadRow = {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
  ai_personalized_pitch: string | null
}

type StoredGenerationRow = {
  id: string
  output_text: string
  model: string
  prompt_version: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost_usd: number
  created_at: string
}

type UsageSummary = {
  tier: 'starter' | 'closer' | 'closer_plus' | 'team'
  used: number
  limit: number | null
  remaining: number | null
  window: 'monthly'
  windowStart: string
}

function parseStoredOutputs(raw: string): z.infer<typeof AiPitchOutputsSchema> | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    const validated = AiPitchOutputsSchema.safeParse(parsed)
    if (!validated.success) return null
    return validated.data
  } catch {
    return null
  }
}

async function getOwnedLead(supabase: ReturnType<typeof createRouteClient>, userId: string, leadId: string): Promise<LeadRow | null> {
  const { data, error } = await supabase
    .from('leads')
    .select('id, company_name, company_domain, company_url, ai_personalized_pitch')
    .eq('id', leadId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as LeadRow | null) ?? null
}

async function getUsageSummary(args: {
  supabase: ReturnType<typeof createRouteClient>
  userId: string
  tier: UsageSummary['tier']
}): Promise<UsageSummary> {
  const windowStart = getCurrentMonthlyUsageWindowStart()
  const { count, error } = await args.supabase
    .from('ai_generations')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', args.userId)
    .eq('generation_type', 'pitch_bundle')
    .gte('created_at', windowStart)

  if (error) throw error
  const usedFinal = typeof count === 'number' ? count : 0
  const tierLimit = getAiPitchLimitForTier(args.tier)
  const remaining = typeof tierLimit.limit === 'number' ? Math.max(0, tierLimit.limit - usedFinal) : null

  return {
    tier: args.tier,
    used: usedFinal,
    limit: tierLimit.limit,
    remaining,
    window: tierLimit.window,
    windowStart,
  }
}

async function getLatestPitchBundle(supabase: ReturnType<typeof createRouteClient>, userId: string, leadId: string): Promise<StoredGenerationRow | null> {
  const { data, error } = await supabase
    .from('ai_generations')
    .select('id, output_text, model, prompt_version, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, created_at')
    .eq('user_id', userId)
    .eq('lead_id', leadId)
    .eq('generation_type', 'pitch_bundle')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as StoredGenerationRow | null) ?? null
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId: rawLeadId } = await ctx.params
  const parsedLeadId = LeadIdSchema.safeParse(rawLeadId)
  if (!parsedLeadId.success) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Invalid lead id')
  }

  const GET_HANDLER = withApiGuard(async (req, { requestId, userId }) => {
    const bridge = createCookieBridge()
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const supabase = createRouteClient(req, bridge)

    try {
      const lead = await getOwnedLead(supabase, userId, parsedLeadId.data)
      if (!lead) {
        return fail(ErrorCode.NOT_FOUND, 'Lead not found', undefined, { status: 404 }, bridge, requestId)
      }

      const tier = await getUserTierForGating({ userId, sessionEmail: null, supabase })
      const [latest, usage] = await Promise.all([
        getLatestPitchBundle(supabase, userId, parsedLeadId.data),
        getUsageSummary({ supabase, userId, tier }),
      ])

      const outputs = latest ? parseStoredOutputs(latest.output_text) : null

      return ok(
        {
          lead: {
            id: lead.id,
            companyName: lead.company_name,
            companyDomain: lead.company_domain,
            companyUrl: lead.company_url,
          },
          generation: latest && outputs
            ? {
                id: latest.id,
                outputs,
                model: latest.model,
                promptVersion: latest.prompt_version,
                tokens: {
                  prompt: latest.prompt_tokens,
                  completion: latest.completion_tokens,
                  total: latest.total_tokens,
                },
                estimatedCostUsd: Number(latest.estimated_cost_usd ?? 0),
                generatedAt: latest.created_at,
              }
            : null,
          usage,
        },
        undefined,
        bridge,
        requestId
      )
    } catch (error) {
      return asHttpError(error, '/api/leads/[leadId]/ai-pitch', userId, bridge, requestId)
    }
  })

  return GET_HANDLER(request)
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId: rawLeadId } = await ctx.params
  const parsedLeadId = LeadIdSchema.safeParse(rawLeadId)
  if (!parsedLeadId.success) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Invalid lead id')
  }

  const POST_HANDLER = withApiGuard(
    async (req, { body, requestId, userId }) => {
      const bridge = createCookieBridge()
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const supabase = createRouteClient(req, bridge)

      try {
        const lead = await getOwnedLead(supabase, userId, parsedLeadId.data)
        if (!lead) {
          return fail(ErrorCode.NOT_FOUND, 'Lead not found', undefined, { status: 404 }, bridge, requestId)
        }

        const input = body as z.infer<typeof PostBodySchema>
        const promptInput = input.promptInput ?? {}
        const tier = await getUserTierForGating({ userId, sessionEmail: null, supabase })
        const usage = await getUsageSummary({ supabase, userId, tier })

        if (isAiPitchLimitReached({ used: usage.used, limit: usage.limit })) {
          return fail(
            'AI_PITCH_LIMIT_REACHED',
            'AI pitch generation limit reached for your current plan.',
            { usage },
            { status: 429 },
            bridge,
            requestId
          )
        }

        const generated = await generateLeadPitchBundle({
          companyName: lead.company_name,
          companyDomain: lead.company_domain,
          companyUrl: lead.company_url,
          existingPitchDraft: lead.ai_personalized_pitch,
          promptInput,
        })

        const { data: inserted, error: insertError } = await supabase
          .from('ai_generations')
          .insert({
            user_id: userId,
            lead_id: lead.id,
            generation_type: 'pitch_bundle',
            prompt_input: promptInput,
            output_text: JSON.stringify(generated.outputs),
            model: generated.model,
            prompt_version: generated.promptVersion,
            prompt_tokens: generated.promptTokens,
            completion_tokens: generated.completionTokens,
            total_tokens: generated.totalTokens,
            estimated_cost_usd: generated.estimatedCostUsd,
            meta: { regenerate: Boolean(input.regenerate) },
          })
          .select('id, created_at')
          .single()

        if (insertError) {
          logger.error({
            scope: 'ai-pitch',
            message: 'generation_insert_failed',
            requestId,
            userId,
            code: insertError.code,
          })
          return fail(ErrorCode.DATABASE_ERROR, 'Failed to save AI generation', undefined, undefined, bridge, requestId)
        }

        const usageAfter: UsageSummary = {
          ...usage,
          used: usage.used + 1,
          remaining: typeof usage.limit === 'number' ? Math.max(0, usage.limit - (usage.used + 1)) : null,
        }

        return ok(
          {
            generation: {
              id: inserted.id,
              outputs: generated.outputs,
              model: generated.model,
              promptVersion: generated.promptVersion,
              tokens: {
                prompt: generated.promptTokens,
                completion: generated.completionTokens,
                total: generated.totalTokens,
              },
              estimatedCostUsd: generated.estimatedCostUsd,
              generatedAt: inserted.created_at,
            },
            usage: usageAfter,
          },
          { status: 201 },
          bridge,
          requestId
        )
      } catch (error) {
        return asHttpError(error, '/api/leads/[leadId]/ai-pitch', userId, bridge, requestId)
      }
    },
    { bodySchema: PostBodySchema }
  )

  return POST_HANDLER(request)
}
