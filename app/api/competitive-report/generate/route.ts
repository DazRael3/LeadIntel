import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { refreshCompanySourcesForReport } from '@/lib/sources/orchestrate'
import { generateCompetitiveIntelligenceReportSourced } from '@/lib/reports/competitive-report-sourced'
import { looksLikeEmail } from '@/lib/reports/reportFormatGuards'
import { normalizeInputUrl } from '@/lib/sources/normalize'
import { fetchText } from '@/lib/sources/http'
import { normalizeReportInput } from '@/lib/reports/reportInput'
import { assertMinCitationsOrThrow, flattenCitations } from '@/lib/reports/sourceRequirements'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { logAudit } from '@/lib/audit/log'
import { enqueueWebhookEvent } from '@/lib/integrations/webhooks'
import { serverEnv } from '@/lib/env'
import { logProductEvent } from '@/lib/services/analytics'
import {
  cancelPremiumGeneration,
  completePremiumGeneration,
  getPremiumGenerationCapabilities,
  getPremiumGenerationUsage,
  redactTextPreview,
  reservePremiumGeneration,
} from '@/lib/billing/premium-generations'
import { randomUUID } from 'crypto'

const BodySchema = z.object({
  company_name: z.string().trim().min(1).max(120).nullable().optional(),
  company_domain: z.string().trim().min(1).max(120).nullable().optional(),
  input_url: z.string().trim().min(1).max(500).nullable().optional(),
  ticker: z.string().trim().min(1).max(20).nullable().optional(),
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

function firstPartyFallbackCitations(input: {
  companyDomain: string | null
  inputUrl: string | null
  companyName: string | null
}): Array<{ url: string; title?: string; source?: string; type?: string }> {
  const out: Array<{ url: string; title?: string; source?: string; type?: string }> = []
  const normalized = input.inputUrl ? normalizeInputUrl(input.inputUrl) : null
  const base =
    normalized
      ? (() => {
          try {
            return new URL(normalized).origin
          } catch {
            return null
          }
        })()
      : input.companyDomain
        ? `https://${input.companyDomain.replace(/^www\./i, '').toLowerCase()}`
        : null

  if (!base) return out
  const source = input.companyDomain ? input.companyDomain.replace(/^www\./i, '').toLowerCase() : base
  const titleBase = input.companyName?.trim() ? input.companyName.trim() : 'Company'
  for (const path of ['/', '/press', '/news', '/blog', '/security']) {
    const url = `${base}${path}`.replace(/\/+$/g, path === '/' ? '/' : '')
    out.push({ url, title: `${titleBase} ${path === '/' ? 'website' : path.replace('/', '')}`, source, type: 'first_party_fallback' })
  }
  return out
}

async function reachableFirstPartyFallbackCitations(input: {
  companyDomain: string | null
  inputUrl: string | null
  companyName: string | null
}): Promise<Array<{ url: string; title?: string; source?: string; type?: string }>> {
  const candidates = firstPartyFallbackCitations(input)
  if (candidates.length === 0) return []
  const out: Array<{ url: string; title?: string; source?: string; type?: string }> = []
  for (const c of candidates) {
    const res = await fetchText({ url: c.url, timeoutMs: 4500, headers: { accept: 'text/html' } })
    if (!res.ok) continue
    out.push(c)
    if (out.length >= 3) break
  }
  return out
}

export const dynamic = 'force-dynamic'

export const POST = withApiGuard(
  async (request, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    const startedAt = Date.now()
    let reservationId: string | null = null

    try {
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      let input: ReturnType<typeof normalizeReportInput>
      try {
        input = normalizeReportInput(body)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'validation_error'
        return fail(ErrorCode.VALIDATION_ERROR, 'Invalid report input', { code: msg }, { status: 400 }, bridge, requestId)
      }
      const forceRefresh = Boolean((body as z.infer<typeof BodySchema> | undefined)?.force_refresh)

      const supabase = createRouteClient(request, bridge)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const [capabilities, usageBefore] = await Promise.all([
        getPremiumGenerationCapabilities({ supabase, userId: user.id, sessionEmail: user.email ?? null }),
        getPremiumGenerationUsage({ supabase, userId: user.id }),
      ])

      // Idempotency (best-effort): if a report was just generated for the same company key,
      // return it rather than generating and counting again.
      const sinceIso = new Date(Date.now() - 60 * 1000).toISOString()
      const { data: recent } = await supabase
        .from('user_reports')
        .select('id, report_markdown, report_json')
        .eq('user_id', user.id)
        .eq('report_kind', 'competitive')
        .eq('status', 'complete')
        .eq('meta->>companyKey', input.companyKey)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (recent?.id && typeof (recent as { report_markdown?: unknown }).report_markdown === 'string') {
        const usageAfter = usageBefore
        const full = (recent as { report_markdown: string; report_json?: unknown }).report_markdown
        return ok(
          capabilities.blurPremiumSections
            ? {
                reportId: recent.id,
                report_markdown: null,
                report_json: null,
                reportPreviewMarkdown: redactTextPreview(full, 1600),
                isBlurred: true,
                lockedSections: ['report_markdown'] as const,
                usage: usageAfter,
                upgradeRequired: capabilities.tier === 'starter' && (usageAfter.remainingByType?.report ?? 0) <= 0,
                reused: true,
              }
            : {
                reportId: recent.id,
                report_markdown: full,
                report_json: (recent as { report_json?: unknown }).report_json ?? null,
                isBlurred: false,
                lockedSections: [] as const,
                usage: usageAfter,
                upgradeRequired: false,
                reused: true,
              },
          undefined,
          bridge,
          requestId
        )
      }

      if (capabilities.tier === 'starter') {
        const allowed = usageBefore.remainingByType.report > 0
        if (!allowed) {
          return fail(
            'FREE_TIER_GENERATION_LIMIT_REACHED',
            'Starter limit reached: 3 report previews. Upgrade to continue.',
            { usage: usageBefore, upgradeRequired: true },
            { status: 429 },
            bridge,
            requestId
          )
        }
        const reserved = await reservePremiumGeneration({ supabase, capabilities, objectType: 'report' })
        if (!reserved.ok || !reserved.reservationId) {
          const usage = await getPremiumGenerationUsage({ supabase, userId: user.id })
          return fail(
            'FREE_TIER_GENERATION_LIMIT_REACHED',
            'Starter limit reached: 3 report previews. Upgrade to continue.',
            { usage, upgradeRequired: true },
            { status: 429 },
            bridge,
            requestId
          )
        }
        reservationId = reserved.reservationId
      }

      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('what_you_sell, ideal_customer')
        .eq('user_id', user.id)
        .maybeSingle()

      // Refresh (or use cached) sources for up-to-date, citation-backed reporting.
      const refreshedAttempt = await refreshCompanySourcesForReport({
        companyKey: input.companyKey,
        companyName: input.companyName,
        companyDomain: input.companyDomain,
        inputUrl: input.inputUrl,
        ticker: input.ticker,
        force: forceRefresh,
      })
      if (!refreshedAttempt.ok) {
        return fail(
          ErrorCode.DATABASE_ERROR,
          'Failed to refresh sources',
          { errorCode: refreshedAttempt.errorCode },
          undefined,
          bridge,
          requestId
        )
      }
      const refreshed = refreshedAttempt

      const triggerRows =
        input.companyDomain || input.companyName
          ? (
              await (async () => {
                let q = supabase
                  .from('trigger_events')
                  .select('headline, event_type, detected_at, source_url, event_description')
                  .eq('user_id', user.id)
                  .order('detected_at', { ascending: false })
                  .limit(12)
                if (input.companyDomain) q = q.eq('company_domain', input.companyDomain)
                else if (input.companyName) q = q.eq('company_name', input.companyName)
                const { data } = await q
                return data
              })()
            )
          : null
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

      const citations = flattenCitations({
        external: refreshed.bundle.allCitations,
        internalSignalUrls: internalSignals.map((s) => s.sourceUrl),
      })

      // Hard rule: no framework-only reports. Require >=2 unique citations before calling OpenAI.
      try {
        assertMinCitationsOrThrow(citations)
      } catch (e) {
        if (e instanceof Error && e.message === 'NO_SOURCES_FOUND') {
          // Fallback: if the source pipeline is temporarily empty, try using verified first-party URLs
          // derived from the provided domain/input URL. This preserves the “no fabricated sources” rule
          // while avoiding false-negative failures for real companies during transient provider outages.
          const reachable = await reachableFirstPartyFallbackCitations({
            companyDomain: input.companyDomain,
            inputUrl: input.inputUrl,
            companyName: input.companyName,
          })
          const fallback = flattenCitations({ external: reachable as any, internalSignalUrls: [] })
          try {
            assertMinCitationsOrThrow(fallback)
            // If fallback has enough unique citations, continue using fallback citations.
            ;(citations as any).splice(0, citations.length, ...(fallback as any))
          } catch {
            return fail(
              'NO_SOURCES_FOUND',
              'Not enough real-world sources to build a report.',
              {
                tips: [
                  'Add a company website URL for best results.',
                  'If the company is public, add the ticker symbol.',
                  'Try again in a minute—sources may be temporarily unavailable.',
                ],
              },
              { status: 422 },
              bridge,
              requestId
            )
          }
        }
        throw e
      }

      const resolvedName = input.companyName ?? refreshedAttempt.resolvedCompanyName ?? (input.ticker ? `Ticker ${input.ticker}` : null)
      const companyNameForReport = resolvedName ?? 'Unknown company'

      const baseGenArgs = {
        companyName: companyNameForReport,
        companyDomain: input.companyDomain,
        inputUrl: input.inputUrl,
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
      const title = `Competitive report: ${companyNameForReport}`
      const reportId = randomUUID()

      const { data: inserted, error: insertError } = await supabase
        .from('user_reports')
        .insert({
          id: reportId,
          user_id: user.id,
          status: 'complete',
          company_name: companyNameForReport,
          company_domain: input.companyDomain,
          input_url: input.inputUrl,
          title,
          report_markdown: generated.reportMarkdown,
          report_json: generated.reportJson,
          sources_used: citations,
          sources_fetched_at: refreshed.bundle.fetchedAt,
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
            input: { name: input.companyName, url: input.inputUrl, ticker: input.ticker, domain: input.companyDomain },
            sourceCounts: {
              citations: citations.length,
              external: refreshed.bundle.allCitations.length,
              internalSignals: internalSignals.length,
            },
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

      await completePremiumGeneration({
        supabase,
        reservationId,
        objectType: 'report',
        objectId: inserted.id,
      })
      const usageAfter = await getPremiumGenerationUsage({ supabase, userId: user.id })

      // Lifecycle marker: first successful output (best-effort, no blocking).
      try {
        const { data: ls } = await supabase.from('lifecycle_state').select('first_output_at').eq('user_id', user.id).maybeSingle()
        const first = (ls as { first_output_at?: string | null } | null)?.first_output_at ?? null
        if (!first) {
          await supabase.from('lifecycle_state').upsert({ user_id: user.id }, { onConflict: 'user_id' })
          await supabase
            .from('lifecycle_state')
            .update({ first_output_at: new Date().toISOString(), last_active_at: new Date().toISOString() })
            .eq('user_id', user.id)
        } else {
          await supabase.from('lifecycle_state').update({ last_active_at: new Date().toISOString() }).eq('user_id', user.id)
        }
      } catch {
        // best-effort only
      }

      // Best-effort: audit log for team workspaces (no content).
      try {
        await ensurePersonalWorkspace({ supabase, userId: user.id })
        const ws = await getCurrentWorkspace({ supabase, userId: user.id })
        if (ws) {
          const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
          if (membership) {
            await logAudit({
              supabase,
              workspaceId: ws.id,
              actorUserId: user.id,
              action: 'report.generated',
              targetType: 'report',
              targetId: inserted.id,
              meta: { reportKind: 'competitive', companyKey: input.companyKey, forceRefresh },
              request,
            })

            await enqueueWebhookEvent({
              workspaceId: ws.id,
              eventType: 'report.generated',
              eventId: inserted.id,
              payload: {
                report: {
                  id: inserted.id,
                  kind: 'competitive',
                  companyKey: input.companyKey,
                  citationCount: citations.length,
                },
                generatedAt: new Date().toISOString(),
              },
            })

            // Guided workflow: allow recipes to create action queue items from this trigger.
            try {
              const { runRecipesForTrigger } = await import('@/lib/services/action-recipes')
              const ran = await runRecipesForTrigger({
                supabase,
                workspaceId: ws.id,
                userId: user.id,
                trigger: 'report_generated',
                leadId: null,
                explainability: null,
                triggerMeta: { reportId: inserted.id, reportKind: 'competitive', companyKey: input.companyKey },
                reason: 'Report generated',
              })
              if ((ran.createdQueueItemIds ?? []).length > 0) {
                await logProductEvent({
                  userId: user.id,
                  eventName: 'action_recipe_run',
                  eventProps: { trigger: 'report_generated', created: ran.createdQueueItemIds.length, reportId: inserted.id, companyKey: input.companyKey },
                })
              }
            } catch {
              // best-effort
            }
          }
        }
      } catch {
        // best-effort
      }

      if (serverEnv.ENABLE_PRODUCT_ANALYTICS === '1' || serverEnv.ENABLE_PRODUCT_ANALYTICS === 'true') {
        try {
          await logProductEvent({
            userId: user.id,
            eventName: 'generation_succeeded',
            eventProps: { kind: 'report', reportKind: 'competitive', objectId: inserted.id, companyKey: input.companyKey, citations: citations.length },
          })
        } catch {
          // best-effort
        }
      }

      return ok(
        capabilities.blurPremiumSections
          ? {
              reportId: inserted.id,
              report_markdown: null,
              report_json: null,
              reportPreviewMarkdown: redactTextPreview(generated.reportMarkdown, 1600),
              isBlurred: true,
              lockedSections: ['report_markdown'] as const,
              usage: usageAfter,
              upgradeRequired: capabilities.tier === 'starter' && (usageAfter.remainingByType?.report ?? 0) <= 0,
            }
          : {
              reportId: inserted.id,
              report_markdown: generated.reportMarkdown,
              report_json: generated.reportJson,
              isBlurred: false,
              lockedSections: [] as const,
              usage: usageAfter,
              upgradeRequired: false,
            },
        undefined,
        bridge,
        requestId
      )
    } catch (error) {
      if (serverEnv.ENABLE_PRODUCT_ANALYTICS === '1' || serverEnv.ENABLE_PRODUCT_ANALYTICS === 'true') {
        try {
          await logProductEvent({
            userId: userId ?? null,
            eventName: 'generation_failed',
            eventProps: { kind: 'report', reportKind: 'competitive', errorCode: error instanceof Error ? (error.message || error.name) : 'unknown_error' },
          })
        } catch {
          // best-effort
        }
      }
      try {
        const supabase = createRouteClient(request, bridge)
        await cancelPremiumGeneration({ supabase, reservationId })
      } catch {
        // best-effort
      }
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

