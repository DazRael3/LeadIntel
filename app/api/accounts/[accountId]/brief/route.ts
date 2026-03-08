import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { normalizeCompanyKey } from '@/lib/sources/normalize'
import { refreshCompanySourcesForReport } from '@/lib/sources/orchestrate'
import { getAccountExplainability } from '@/lib/data/getAccountExplainability'
import { buildAccountBriefMarkdown } from '@/lib/services/account-brief'

export const dynamic = 'force-dynamic'

const PostBodySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional(),
  force_refresh_sources: z.boolean().optional(),
})

const GetQuerySchema = z.object({
  window: z.enum(['7d', '30d', '90d', 'all']).optional(),
})

type DbLeadRow = {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
}

type SnapshotRow = { fetched_at: string; citations: unknown }

function extractAccountIdFromPath(pathname: string): string | null {
  // /api/accounts/[accountId]/brief
  const parts = pathname.split('/').filter(Boolean)
  const accountId = parts.at(-2)
  return typeof accountId === 'string' && accountId.trim().length > 0 ? accountId : null
}

function extractCitations(input: unknown): Array<{ url: string; title?: string | null }> {
  if (!Array.isArray(input)) return []
  const out: Array<{ url: string; title?: string | null }> = []
  for (const x of input) {
    if (!x || typeof x !== 'object') continue
    const obj = x as { url?: unknown; title?: unknown }
    const url = typeof obj.url === 'string' ? obj.url.trim() : ''
    if (!url) continue
    const title = typeof obj.title === 'string' ? obj.title.trim() : null
    out.push({ url, ...(title ? { title } : {}) })
    if (out.length >= 6) break
  }
  return out
}

export const GET = withApiGuard(
  async (request: NextRequest, { query, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const accountId = extractAccountIdFromPath(new URL(request.url).pathname)
      if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

      const q = query as z.infer<typeof GetQuerySchema>
      const supabase = createRouteClient(request, bridge)

      const { data, error } = await supabase
        .from('user_reports')
        .select('id, created_at, title, report_markdown, sources_fetched_at, meta')
        .eq('user_id', userId)
        .eq('report_kind', 'account_brief')
        .eq('meta->>leadId', accountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to load brief', { message: error.message }, undefined, bridge, requestId)
      }

      return ok({ brief: data ?? null, window: q.window ?? null }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/accounts/[accountId]/brief', userId, bridge, requestId)
    }
  },
  { querySchema: GetQuerySchema }
)

export const POST = withApiGuard(
  async (request: NextRequest, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const accountId = extractAccountIdFromPath(new URL(request.url).pathname)
      if (!accountId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing account id', undefined, { status: 400 }, bridge, requestId)

      const parsed = PostBodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Invalid request body', parsed.error.flatten(), { status: 400 }, bridge, requestId)
      }

      const window = parsed.data.window ?? '30d'
      const forceRefreshSources = Boolean(parsed.data.force_refresh_sources)

      const supabase = createRouteClient(request, bridge)
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, company_name, company_domain, company_url')
        .eq('id', accountId)
        .eq('user_id', userId)
        .maybeSingle()

      if (leadError || !lead) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)

      const leadRow = lead as unknown as DbLeadRow
      const companyName = (leadRow.company_name ?? '').trim() || 'Unknown company'

      const key = normalizeCompanyKey({
        companyName,
        companyDomain: leadRow.company_domain,
        inputUrl: leadRow.company_url,
      })

      if (forceRefreshSources) {
        // Best-effort: refresh sources for briefs only when explicitly requested.
        await refreshCompanySourcesForReport({
          companyKey: key.companyKey,
          companyName,
          companyDomain: key.companyDomain,
          inputUrl: key.inputUrl,
          ticker: null,
          force: true,
        })
      }

      const admin = createSupabaseAdminClient({ schema: 'api' })
      const { data: firstPartySnap } = await admin
        .from('company_source_snapshots')
        .select('fetched_at, citations')
        .eq('company_key', key.companyKey)
        .eq('source_type', 'first_party')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const firstParty = (firstPartySnap ?? null) as unknown as SnapshotRow | null
      const firstPartyCitations = extractCitations(firstParty?.citations)

      const explainability = await getAccountExplainability({
        supabase,
        userId,
        accountId,
        window,
        type: null,
        sort: 'recent',
        limit: 50,
      })
      if (!explainability) return fail(ErrorCode.NOT_FOUND, 'Account not found', undefined, { status: 404 }, bridge, requestId)

      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('what_you_sell, ideal_customer')
        .eq('user_id', userId)
        .maybeSingle()

      const briefMarkdown = buildAccountBriefMarkdown({
        account: {
          id: explainability.account.id,
          companyName,
          companyDomain: key.companyDomain,
          inputUrl: key.inputUrl,
        },
        window,
        momentum: explainability.momentum,
        signals: explainability.signals,
        firstPartyIntent: {
          visitorMatchesCount: explainability.firstPartyIntent.visitorMatches.count,
          lastVisitedAt: explainability.firstPartyIntent.visitorMatches.lastVisitedAt,
        },
        firstPartySources: {
          fetchedAt: typeof firstParty?.fetched_at === 'string' ? firstParty.fetched_at : null,
          citations: firstPartyCitations,
        },
        userContext: {
          whatYouSell: typeof userSettings?.what_you_sell === 'string' ? userSettings.what_you_sell : null,
          idealCustomer: typeof userSettings?.ideal_customer === 'string' ? userSettings.ideal_customer : null,
        },
      })

      const sourcesUsed = [
        ...explainability.signals
          .map((s) => (typeof s.sourceUrl === 'string' ? s.sourceUrl : null))
          .filter((x): x is string => typeof x === 'string' && x.startsWith('http'))
          .slice(0, 10)
          .map((url) => ({ url, type: 'signal', source: 'internal' })),
        ...firstPartyCitations.map((c) => ({ url: c.url, type: 'first_party', source: 'first_party' })),
      ]

      const title = `Account brief: ${companyName}`
      const { data: inserted, error: insertError } = await supabase
        .from('user_reports')
        .insert({
          user_id: userId,
          status: 'complete',
          company_name: companyName,
          company_domain: key.companyDomain,
          input_url: key.inputUrl,
          title,
          report_markdown: briefMarkdown,
          report_json: null,
          sources_used: sourcesUsed,
          sources_fetched_at: typeof firstParty?.fetched_at === 'string' ? firstParty.fetched_at : null,
          report_kind: 'account_brief',
          report_version: 1,
          meta: {
            reportKind: 'account_brief',
            leadId: accountId,
            companyKey: key.companyKey,
            version: 'v1',
            signalWindow: window,
            generatedAt: new Date().toISOString(),
          },
        })
        .select('id')
        .single()

      if (insertError || !inserted?.id) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to save brief', { message: insertError?.message }, undefined, bridge, requestId)
      }

      return ok({ reportId: inserted.id, brief_markdown: briefMarkdown }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/accounts/[accountId]/brief', userId, bridge, requestId)
    }
  },
  { bodySchema: PostBodySchema }
)

