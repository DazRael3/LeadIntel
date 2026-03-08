import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { refreshCompanySources } from '@/lib/sources/orchestrate'
import { generateCompetitiveIntelligenceReportSourced } from '@/lib/reports/competitive-report-sourced'
import { normalizeCompanyKey } from '@/lib/sources/normalize'
import { looksLikeEmail } from '@/lib/reports/reportFormatGuards'

const BodySchema = z.object({
  company_name: z.string().trim().min(1).max(120),
  company_domain: z.string().trim().min(1).max(120).nullable().optional(),
  input_url: z.string().trim().url().nullable().optional(),
  force_refresh: z.boolean().optional(),
})

type TriggerEventRow = {
  headline: string | null
  event_type: string | null
  detected_at: string | null
  source_url: string | null
  event_description: string | null
}

function isDemoTriggerEvent(row: TriggerEventRow): boolean {
  const headline = (row.headline ?? '').toLowerCase()
  if (headline.startsWith('demo event:')) return true
  const desc = (row.event_description ?? '').toLowerCase()
  if (desc.includes('demo trigger event')) return true
  return false
}

export const dynamic = 'force-dynamic'

export const POST = withApiGuard(
  async (request, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    const startedAt = Date.now()

    try {
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const data = body as z.infer<typeof BodySchema>
      const companyName = data.company_name.trim()
      const companyDomain = data.company_domain ? data.company_domain.trim() : null
      const inputUrl = data.input_url ? data.input_url.trim() : null
      const forceRefresh = Boolean(data.force_refresh)

      const supabase = createRouteClient(request, bridge)

      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('what_you_sell, ideal_customer')
        .eq('user_id', userId)
        .maybeSingle()

      // Refresh (or use cached) sources for up-to-date, citation-backed reporting.
      const refreshedAttempt = await refreshCompanySources({
        companyName,
        companyDomain,
        inputUrl,
        force: forceRefresh,
      })
      const refreshed = refreshedAttempt.ok
        ? refreshedAttempt
        : {
            ok: true as const,
            data: { companyKey: normalizeCompanyKey({ companyName, companyDomain, inputUrl }).companyKey, refreshed: [], failed: [], fetchedAt: new Date().toISOString() },
            bundle: {
              companyKey: normalizeCompanyKey({ companyName, companyDomain, inputUrl }).companyKey,
              fetchedAt: new Date().toISOString(),
              sources: {},
              allCitations: [],
            },
          }

      let q = supabase
        .from('trigger_events')
        .select('headline, event_type, detected_at, source_url, event_description')
        .eq('user_id', userId)
        .order('detected_at', { ascending: false })
        .limit(12)

      if (companyDomain) {
        q = q.eq('company_domain', companyDomain)
      } else {
        q = q.eq('company_name', companyName)
      }

      const { data: triggerRows } = await q
      const internalSignals = ((triggerRows ?? []) as TriggerEventRow[])
        .filter((r) => !isDemoTriggerEvent(r))
        .slice(0, 8)
        .map((r) => ({
          headline: (r.headline ?? '').trim(),
          detectedAt: r.detected_at ?? null,
          sourceUrl: (r.source_url ?? '').trim(),
          summary: typeof r.event_description === 'string' ? r.event_description.trim() : null,
        }))
        .filter((s) => s.headline.length > 0 && s.sourceUrl.startsWith('http'))

      const baseGenArgs = {
        companyName,
        companyDomain,
        inputUrl,
        fetchedAt: refreshed.bundle.fetchedAt,
        sources: refreshed.bundle,
        userContext: {
          whatYouSell: typeof userSettings?.what_you_sell === 'string' ? userSettings.what_you_sell : null,
          idealCustomer: typeof userSettings?.ideal_customer === 'string' ? userSettings.ideal_customer : null,
        },
        internalSignals,
      } satisfies Parameters<typeof generateCompetitiveIntelligenceReportSourced>[0]

      let generated = await generateCompetitiveIntelligenceReportSourced(baseGenArgs)
      if (looksLikeEmail(generated.reportMarkdown)) {
        // One strict-format retry to avoid persisting email-like output as a report.
        generated = await generateCompetitiveIntelligenceReportSourced({ ...baseGenArgs, strictFormat: true })
        if (looksLikeEmail(generated.reportMarkdown)) {
          throw new Error('REPORT_FORMAT_INVALID')
        }
      }

      const latencyMs = Date.now() - startedAt
      const title = `Competitive report: ${companyName}`

      const { data: inserted, error: insertError } = await supabase
        .from('user_reports')
        .insert({
          user_id: userId,
          status: 'complete',
          company_name: companyName,
          company_domain: companyDomain,
          input_url: inputUrl,
          title,
          report_markdown: generated.reportMarkdown,
          report_json: generated.reportJson,
          sources_used: generated.sourcesUsed,
          sources_fetched_at: refreshedAttempt.ok ? refreshed.bundle.fetchedAt : null,
          report_kind: 'competitive',
          report_version: 1,
          meta: {
            source: 'competitive-report',
            generatedAt: new Date().toISOString(),
            model: generated.model,
            latencyMs,
            internalSignalsCount: internalSignals.length,
            companyKey: refreshed.bundle.companyKey,
            refreshed: refreshed.data.refreshed,
            failed: refreshed.data.failed,
            forceRefresh,
            sourcesRefreshErrorCode: refreshedAttempt.ok ? null : refreshedAttempt.errorCode,
          },
        })
        .select('id')
        .single()

      if (insertError || !inserted?.id) {
        return fail(
          ErrorCode.DATABASE_ERROR,
          'Failed to save report',
          { hint: 'Check api.user_reports RLS and schema.' },
          undefined,
          bridge,
          requestId
        )
      }

      return ok(
        { reportId: inserted.id, report_markdown: generated.reportMarkdown, report_json: generated.reportJson },
        undefined,
        bridge,
        requestId
      )
    } catch (error) {
      // Persist a failed report record (best-effort, user-scoped via RLS). Never block the response.
      try {
        const data = body as Partial<z.infer<typeof BodySchema>> | undefined
        const companyName =
          (typeof data?.company_name === 'string' && data.company_name.trim()) ? data.company_name.trim() : 'Unknown company'
        const companyDomain = typeof data?.company_domain === 'string' ? data.company_domain.trim() : null
        const inputUrl = typeof data?.input_url === 'string' ? data.input_url.trim() : null

        const supabase = createRouteClient(request, bridge)
        await supabase.from('user_reports').insert({
          user_id: userId,
          status: 'failed',
          company_name: companyName,
          company_domain: companyDomain,
          input_url: inputUrl,
          title: `Competitive report failed: ${companyName}`,
          report_markdown:
            error instanceof Error && error.message === 'REPORT_FORMAT_INVALID'
              ? '# Competitive Intelligence Report\n\nWe couldn’t save this report because the generated content did not match the required report format.\n\n## What you can do next\n- Try again.\n- If it repeats, refresh sources and regenerate.\n\n## Verification checklist\n- Homepage / product page\n- Pricing page\n- Careers page\n- Press / blog\n- Review sites (G2/Capterra)\n- LinkedIn posts\n'
              : '# Competitive Intelligence Report\n\nWe couldn’t complete this report due to a temporary issue.\n\n## What you can do next\n- Try again in a moment.\n- If this repeats, check your OpenAI configuration and server logs.\n\n## Verification checklist\n- Homepage / product page\n- Pricing page\n- Careers page\n- Press / blog\n- Review sites (G2/Capterra)\n- LinkedIn posts\n',
          report_json: null,
          sources_used: [],
          sources_fetched_at: null,
          report_kind: 'competitive',
          report_version: 1,
          meta: {
            source: 'competitive-report',
            generatedAt: new Date().toISOString(),
            errorCode: error instanceof Error ? error.name : 'unknown_error',
          },
        })
      } catch {
        // best-effort
      }

      if (error instanceof Error && error.message === 'REPORT_FORMAT_INVALID') {
        return fail(
          ErrorCode.EXTERNAL_API_ERROR,
          'Report format invalid — please try again',
          { code: 'REPORT_FORMAT_INVALID' },
          undefined,
          bridge,
          requestId
        )
      }

      // Prefer a safe external-api style error code for generator failures.
      if (error instanceof Error && error.message.includes('openai')) {
        return fail(ErrorCode.EXTERNAL_API_ERROR, 'Competitive report generation failed', undefined, undefined, bridge, requestId)
      }

      return asHttpError(error, '/api/competitive-report/generate', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

