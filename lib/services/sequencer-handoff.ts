import type { SupabaseClient } from '@supabase/supabase-js'
import { getAccountExplainability, type ExplainabilityWindow } from '@/lib/data/getAccountExplainability'
import { buildSequencerHandoffPayload, type SequencerHandoffPayload } from '@/lib/services/destination-payloads'
import { derivePatternBucket } from '@/lib/services/cohorting'
import { suggestUseCasePlaybookSlug } from '@/lib/services/benchmarking-metadata'

type DbLeadRow = {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
  ai_personalized_pitch: string | null
}

function truncateText(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return t.slice(0, Math.max(0, max - 3)) + '...'
}

export async function prepareSequencerHandoff(args: {
  supabase: SupabaseClient
  userId: string
  accountId: string
  window: ExplainabilityWindow
}): Promise<{
  companyName: string
  payload: SequencerHandoffPayload
  benchmarkMeta: { patternBucket: string; playbookSlug: string | null }
}> {
  const { data: lead, error: leadError } = await args.supabase
    .schema('api')
    .from('leads')
    .select('id, company_name, company_domain, company_url, ai_personalized_pitch')
    .eq('id', args.accountId)
    .eq('user_id', args.userId)
    .maybeSingle()

  if (leadError || !lead) throw new Error('account_not_found')
  const leadRow = lead as unknown as DbLeadRow
  const companyName = (leadRow.company_name ?? '').trim() || 'Unknown company'

  const explainability = await getAccountExplainability({
    supabase: args.supabase,
    userId: args.userId,
    accountId: args.accountId,
    window: args.window,
    type: null,
    sort: 'recent',
    limit: 50,
  })
  if (!explainability) throw new Error('account_not_found')

  const topPersona = explainability.people.personas.topPersonas?.[0] ?? null
  const targetPersona = explainability.people.personas.champion ?? topPersona

  const suggested = explainability.people.personas.items?.find((p) => p.persona === targetPersona)?.suggestedFirstTouch?.text ?? null
  const fallbackOpener =
    typeof leadRow.ai_personalized_pitch === 'string' && leadRow.ai_personalized_pitch.trim().length > 0
      ? truncateText(leadRow.ai_personalized_pitch, 900)
      : null

  const opener = typeof suggested === 'string' && suggested.trim().length > 0 ? truncateText(suggested, 900) : fallbackOpener
  const followupAngle = explainability.people.personas.items?.find((p) => p.persona === targetPersona)?.whyNowAngle ?? null

  const payload = buildSequencerHandoffPayload({
    explainability,
    companyName,
    opener,
    followupAngle: typeof followupAngle === 'string' ? truncateText(followupAngle, 220) : null,
    targetPersona: typeof targetPersona === 'string' ? targetPersona : null,
  })

  return { companyName, payload, benchmarkMeta: { patternBucket: derivePatternBucket(explainability), playbookSlug: suggestUseCasePlaybookSlug(explainability) } }
}

