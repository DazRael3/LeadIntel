import type { SupabaseClient } from '@supabase/supabase-js'
import { getAccountExplainability, type ExplainabilityWindow } from '@/lib/data/getAccountExplainability'
import { buildCrmHandoffPayload, type CrmHandoffPayload } from '@/lib/services/destination-payloads'
import { derivePatternBucket } from '@/lib/services/cohorting'
import { suggestUseCasePlaybookSlug } from '@/lib/services/benchmarking-metadata'

type DbLeadRow = {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
}

export async function prepareCrmHandoff(args: {
  supabase: SupabaseClient
  userId: string
  accountId: string
  window: ExplainabilityWindow
  mode: CrmHandoffPayload['crm']['mode']
}): Promise<{
  companyName: string
  payload: CrmHandoffPayload
  briefReportId: string | null
  benchmarkMeta: { patternBucket: string; playbookSlug: string | null }
}> {
  const { data: lead, error: leadError } = await args.supabase
    .schema('api')
    .from('leads')
    .select('id, company_name, company_domain, company_url')
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

  const { data: latestBrief } = await args.supabase
    .from('user_reports')
    .select('id, created_at')
    .eq('user_id', args.userId)
    .eq('report_kind', 'account_brief')
    .eq('meta->>leadId', args.accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const briefReportId = (latestBrief as { id?: unknown } | null)?.id
  const payload = buildCrmHandoffPayload({
    explainability,
    companyName,
    mode: args.mode,
    briefReportId: typeof briefReportId === 'string' ? briefReportId : null,
  })

  return {
    companyName,
    payload,
    briefReportId: typeof briefReportId === 'string' ? briefReportId : null,
    benchmarkMeta: { patternBucket: derivePatternBucket(explainability), playbookSlug: suggestUseCasePlaybookSlug(explainability) },
  }
}

