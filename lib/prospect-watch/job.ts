import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/app-url'
import { serverEnv } from '@/lib/env'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { sendEmailDeduped } from '@/lib/email/send-deduped'
import { renderAdminNotificationEmail } from '@/lib/email/internal'
import { captureServerEvent } from '@/lib/analytics/posthog-server'
import { prospectWatchEnabled, getReviewEmails, getRssFeeds, highPriorityEnabled, highPriorityThreshold, prospectDailyDigestEnabled, contentDailyDigestEnabled } from '@/lib/prospect-watch/config'
import { ingestRssSignals } from '@/lib/prospect-watch/rss'
import { scoreProspect } from '@/lib/prospect-watch/scoring'
import { generateLinkedInPostDraft, generateOutreachDrafts } from '@/lib/prospect-watch/drafts'
import type { ProspectSignalType } from '@/lib/prospect-watch/classify'
import { getResendReplyToEmail } from '@/lib/email/routing'
import { bumpReject, createIngestStats, type ProspectWatchIngestStats } from '@/lib/prospect-watch/ingest-stats'

type TargetRow = {
  id: string
  workspace_id: string
  company_name: string
  company_domain: string | null
  icp_fit_manual_score: number
  status: string
}

type SignalRow = {
  id: string
  occurred_at: string | null
  confidence: number
  signal_type: ProspectSignalType
  title: string
  summary: string | null
}

type ScoreRow = { id: string; overall_score: number }

type ProspectRow = { id: string; status: string; overall_score: number }

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10)
}

function hasResendConfigured(): boolean {
  return Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean((serverEnv.RESEND_FROM_EMAIL ?? '').trim())
}

function isProspectSignalType(v: unknown): v is ProspectSignalType {
  return (
    v === 'hiring' ||
    v === 'funding' ||
    v === 'product_launch' ||
    v === 'partnership' ||
    v === 'expansion' ||
    v === 'leadership_hire' ||
    v === 'stack_change' ||
    v === 'other'
  )
}

export async function runProspectWatch(args: { dryRun?: boolean; limitTargets?: number }) {
  if (!prospectWatchEnabled()) {
    return { status: 'skipped' as const, summary: { reason: 'prospect_watch_disabled' } }
  }
  const dryRun = Boolean(args.dryRun)
  const limitTargets = typeof args.limitTargets === 'number' && Number.isFinite(args.limitTargets) ? Math.max(1, Math.min(200, Math.floor(args.limitTargets))) : 50
  const feeds = getRssFeeds()
  if (feeds.length === 0) {
    return { status: 'skipped' as const, summary: { reason: 'no_rss_feeds_configured' } }
  }

  const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
  if (!hasServiceRole) {
    return { status: 'skipped' as const, summary: { reason: 'supabase_admin_not_configured' } }
  }

  const admin = createSupabaseAdminClient({ schema: 'api' })
  const now = new Date()
  const appUrl = getAppUrl()

  const { data: targets, error } = await admin
    .from('prospect_watch_targets')
    .select('id, workspace_id, company_name, company_domain, icp_fit_manual_score, status, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limitTargets)

  if (error) return { status: 'error' as const, summary: { error: 'targets_query_failed', message: error.message } }
  const rows = (targets ?? []) as unknown as TargetRow[]
  if (rows.length === 0) return { status: 'ok' as const, summary: { targets: 0, signals: 0, prospectsUpserted: 0 } }

  let signalsInserted = 0
  let prospectsUpserted = 0
  let draftsUpserted = 0
  let contentUpserted = 0
  let highPriorityNotified = 0
  const ingest = createIngestStats({ feedsAttempted: feeds.length })

  for (const t of rows) {
    const companyName = (t.company_name ?? '').trim()
    if (!companyName) continue

    const ingested = await ingestRssSignals({
      feedUrls: feeds,
      target: { companyName, companyDomain: (t.company_domain ?? null) as string | null },
      maxItems: 10,
    })
    // Aggregate ingestion stats across targets.
    ingest.feedsFetchedOk += ingested.stats.feedsFetchedOk
    ingest.feedsParsedOk += ingested.stats.feedsParsedOk
    ingest.itemsScanned += ingested.stats.itemsScanned
    ingest.itemsMatched += ingested.stats.itemsMatched
    ingest.signalsProposed += ingested.stats.signalsProposed
    for (const [k, v] of Object.entries(ingested.stats.rejected)) {
      ingest.rejected[k as keyof ProspectWatchIngestStats['rejected']] =
        (ingest.rejected[k as keyof ProspectWatchIngestStats['rejected']] ?? 0) + (v ?? 0)
    }

    for (const s of ingested.signals) {
      // Insert signal (deduped by unique constraint on (workspace_id, source_url))
      if (!dryRun) {
        const ins = await admin.from('prospect_watch_signals').insert({
          workspace_id: t.workspace_id,
          target_id: t.id,
          source_type: 'rss',
          source_url: s.sourceUrl,
          source_name: s.sourceName,
          signal_type: s.classified.signalType,
          title: s.title,
          summary: s.snippet ? s.snippet.slice(0, 500) : s.classified.summary,
          occurred_at: s.occurredAt ? s.occurredAt.toISOString() : null,
          confidence: s.classified.confidence,
          meta: { classifier: s.classified.summary },
        })
        if (!ins.error) {
          signalsInserted += 1
          ingest.signalsInserted += 1
        } else if (ins.error.code === '23505') {
          ingest.signalsDeduped += 1
          bumpReject(ingest, 'duplicate_signal')
        }
      } else {
        signalsInserted += 1
      }

      // Resolve signal id for downstream upserts (best-effort, only when not dryRun).
      if (dryRun) continue
      const { data: signalRow } = await admin
        .from('prospect_watch_signals')
        .select('id, occurred_at, confidence, signal_type, title, summary')
        .eq('workspace_id', t.workspace_id)
        .eq('source_url', s.sourceUrl)
        .maybeSingle()
      const signalId = (signalRow as { id?: string } | null)?.id ?? null
      if (!signalId) continue

      // Score + upsert score row
      const signal = signalRow as unknown as Partial<SignalRow> | null
      const occurredAt = typeof signal?.occurred_at === 'string' ? new Date(signal.occurred_at) : null
      const confidence = typeof signal?.confidence === 'number' ? signal.confidence : 50
      const signalType: ProspectSignalType = isProspectSignalType(signal?.signal_type) ? signal.signal_type : s.classified.signalType
      const scored = scoreProspect({
        icpFitManual: t.icp_fit_manual_score,
        signalType,
        confidence,
        occurredAt,
        now,
      })
      const scoreUpsert = await admin.from('prospect_watch_scores').upsert(
        {
          workspace_id: t.workspace_id,
          target_id: t.id,
          signal_id: signalId,
          icp_fit_score: scored.icpFit,
          signal_strength_score: scored.signalStrength,
          urgency_score: scored.urgency,
          confidence_score: scored.confidence,
          overall_score: scored.overall,
          reasons: scored.reasons,
          computed_at: now.toISOString(),
        },
        { onConflict: 'target_id,signal_id' }
      )
      if (!scoreUpsert.error) {
        void captureServerEvent({ distinctId: t.workspace_id, event: 'prospect_scored', properties: { overall: scored.overall, signalType } })
      }

      // Upsert prospect record
      const { data: scoreRow } = await admin
        .from('prospect_watch_scores')
        .select('id, overall_score')
        .eq('target_id', t.id)
        .eq('signal_id', signalId)
        .maybeSingle()
      const scoreId = (scoreRow as { id?: string } | null)?.id ?? null
      const overall =
        typeof (scoreRow as unknown as Partial<ScoreRow> | null)?.overall_score === 'number'
          ? (scoreRow as unknown as ScoreRow).overall_score
          : scored.overall
      const prospectUpsert = await admin.from('prospect_watch_prospects').upsert(
        {
          workspace_id: t.workspace_id,
          target_id: t.id,
          signal_id: signalId,
          score_id: scoreId,
          overall_score: overall,
          status: 'new',
        },
        { onConflict: 'workspace_id,target_id,signal_id' }
      )
      if (!prospectUpsert.error) {
        prospectsUpserted += 1
        void captureServerEvent({ distinctId: t.workspace_id, event: 'prospect_detected', properties: { overall, signalType } })
      }

      // Fetch prospect id
      const { data: prospectRow } = await admin
        .from('prospect_watch_prospects')
        .select('id, status, overall_score')
        .eq('workspace_id', t.workspace_id)
        .eq('target_id', t.id)
        .eq('signal_id', signalId)
        .maybeSingle()
      const prospect = prospectRow as unknown as Partial<ProspectRow> | null
      const prospectId = (prospect?.id ?? null) as string | null
      const status = (typeof prospect?.status === 'string' ? prospect.status : 'new') as string
      if (!prospectId) continue

      // Drafts only when still reviewable
      if (status === 'archived' || status === 'rejected' || status === 'sent') continue

      const signalTitle = (typeof signal?.title === 'string' && signal.title.trim().length > 0 ? signal.title : s.title) as string
      const signalSummary = (typeof signal?.summary === 'string' ? signal.summary : null) as string | null

      const drafts = generateOutreachDrafts({
        companyName,
        companyDomain: t.company_domain ?? null,
        signalType,
        signalTitle,
        signalSummary,
      })
      const post = generateLinkedInPostDraft({ companyName, signalType, signalTitle, signalSummary })

      const upserts = await Promise.allSettled([
        admin
          .from('prospect_watch_outreach_drafts')
          .upsert(
            { workspace_id: t.workspace_id, prospect_id: prospectId, channel: 'email', status: 'draft', subject: drafts.email.subject, body: drafts.email.body },
            { onConflict: 'prospect_id,channel' }
          ),
        admin
          .from('prospect_watch_outreach_drafts')
          .upsert(
            { workspace_id: t.workspace_id, prospect_id: prospectId, channel: 'follow_up', status: 'draft', subject: drafts.followUp.subject, body: drafts.followUp.body },
            { onConflict: 'prospect_id,channel' }
          ),
        admin
          .from('prospect_watch_outreach_drafts')
          .upsert(
            { workspace_id: t.workspace_id, prospect_id: prospectId, channel: 'linkedin_dm', status: 'draft', subject: null, body: drafts.linkedinDm.body },
            { onConflict: 'prospect_id,channel' }
          ),
        admin
          .from('prospect_watch_outreach_drafts')
          .upsert(
            { workspace_id: t.workspace_id, prospect_id: prospectId, channel: 'call_opener', status: 'draft', subject: null, body: drafts.callOpener.body },
            { onConflict: 'prospect_id,channel' }
          ),
        admin
          .from('prospect_watch_content_drafts')
          .upsert(
            { workspace_id: t.workspace_id, prospect_id: prospectId, kind: 'linkedin_post', status: 'draft', angle: post.angle, body: post.body, cta: post.cta },
            { onConflict: 'prospect_id,kind' }
          ),
      ])
      const getOk = (idx: number): boolean => {
        const r = upserts[idx]
        return r?.status === 'fulfilled' && !(r.value as { error?: unknown } | undefined)?.error
      }
      draftsUpserted += [0, 1, 2, 3].filter(getOk).length
      contentUpserted += getOk(4) ? 1 : 0
      void captureServerEvent({ distinctId: t.workspace_id, event: 'outreach_draft_generated', properties: { prospectId } })
      void captureServerEvent({ distinctId: t.workspace_id, event: 'linkedin_post_draft_generated', properties: { prospectId } })

      // Optional high priority notification (internal only, deduped).
      if (highPriorityEnabled() && hasResendConfigured() && overall >= highPriorityThreshold()) {
        const tos = getReviewEmails()
        if (tos.length > 0) {
          const email = renderAdminNotificationEmail({
            title: 'High-priority prospect detected',
            appUrl,
            ctaHref: `${appUrl}/settings/prospects`,
            ctaLabel: 'Review prospects',
            lines: [`company: ${companyName}`, `signal: ${signalTitle}`, `score: ${overall}/100`, `source: ${s.sourceUrl}`],
          })
          const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
          await Promise.allSettled(
            tos.map((toEmail) =>
              sendEmailDeduped(admin, {
                dedupeKey: `prospect_watch:high:${prospectId}:${toEmail}`,
                userId: null,
                toEmail,
                fromEmail: from,
                replyTo: getResendReplyToEmail(),
                subject: email.subject,
                html: email.html,
                text: email.text,
                kind: 'internal',
                template: 'prospect_watch_high_priority',
                tags: [{ name: 'kind', value: 'internal' }, { name: 'type', value: 'prospect_watch_high_priority' }],
                meta: { prospectId, workspaceId: t.workspace_id, score: overall },
              })
            )
          )
          highPriorityNotified += 1
          void captureServerEvent({ distinctId: t.workspace_id, event: 'high_priority_notification_sent', properties: { prospectId, overall } })
        }
      }
    }

    if (!dryRun) {
      await admin.from('prospect_watch_targets').update({ last_ingested_at: now.toISOString() }).eq('id', t.id)
    }
  }

  return {
    status: 'ok' as const,
    summary: {
      targets: rows.length,
      feeds: feeds.length,
      signalsInserted,
      prospectsUpserted,
      draftsUpserted,
      contentUpserted,
      highPriorityNotified,
      ingest,
      dryRun,
    },
  }
}

export async function runProspectWatchDigests(args: { dryRun?: boolean }) {
  if (!prospectWatchEnabled()) return { status: 'skipped' as const, summary: { reason: 'prospect_watch_disabled' } }
  const dryRun = Boolean(args.dryRun)
  if (!prospectDailyDigestEnabled() && !contentDailyDigestEnabled()) {
    return { status: 'skipped' as const, summary: { reason: 'digests_disabled' } }
  }
  const tos = getReviewEmails()
  if (tos.length === 0) return { status: 'skipped' as const, summary: { reason: 'no_review_emails_configured' } }
  const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
  const hasResend = hasResendConfigured()
  if (!hasResend) return { status: 'skipped' as const, summary: { reason: 'resend_not_configured' } }
  if (dryRun) return { status: 'skipped' as const, summary: { reason: 'dry_run' } }

  const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
  if (!hasServiceRole) {
    return { status: 'skipped' as const, summary: { reason: 'supabase_admin_not_configured' } }
  }

  const admin = createSupabaseAdminClient({ schema: 'api' })
  const appUrl = getAppUrl()
  const now = new Date()
  const day = todayIso(now)

  type DigestProspect = {
    id: string
    overall_score: number
    status: string
  }
  type DigestContent = {
    id: string
    angle: string
  }

  // Pull top items across workspaces (lean operator view). This is internal tooling; it’s OK to aggregate.
  const prospectsRes = prospectDailyDigestEnabled()
    ? await admin
        .from('prospect_watch_prospects')
        .select('id, overall_score, status')
        .in('status', ['new', 'reviewed'])
        .order('overall_score', { ascending: false })
        .limit(25)
    : { data: [], error: null }

  const sendReadyRes =
    prospectDailyDigestEnabled() || contentDailyDigestEnabled()
      ? await admin
          .from('prospect_watch_outreach_drafts')
          .select('id', { count: 'exact', head: true })
          .eq('send_ready', true)
      : { count: 0, error: null }

  const draftsRes = contentDailyDigestEnabled()
    ? await admin
        .from('prospect_watch_content_drafts')
        .select('id, angle')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(15)
    : { data: [], error: null }

  if (prospectsRes.error) {
    return { status: 'error' as const, summary: { error: 'prospects_query_failed', message: prospectsRes.error.message } }
  }
  if (draftsRes.error) {
    return { status: 'error' as const, summary: { error: 'content_query_failed', message: draftsRes.error.message } }
  }
  if (sendReadyRes.error) {
    return { status: 'error' as const, summary: { error: 'send_ready_query_failed', message: sendReadyRes.error.message } }
  }

  const prospects = (prospectsRes.data ?? []) as unknown as DigestProspect[]
  const drafts = (draftsRes.data ?? []) as unknown as DigestContent[]

  const prospectCount = prospects.length
  const contentCount = drafts.length
  const sendReadyCount = typeof sendReadyRes.count === 'number' ? sendReadyRes.count : 0

  const bodyLines: string[] = []
  bodyLines.push(`Prospects needing review: ${prospectCount}`)
  bodyLines.push(`Content drafts needing review: ${contentCount}`)
  bodyLines.push(`Send-ready outreach drafts: ${sendReadyCount}`)
  bodyLines.push('')
  bodyLines.push(`Review links:`)
  bodyLines.push(`- Prospects: ${appUrl}/settings/prospects`)
  bodyLines.push(`- Content: ${appUrl}/settings/content`)
  bodyLines.push('')
  bodyLines.push(`Top prospects:`)
  for (const p of prospects.slice(0, 10)) {
    const score = typeof p.overall_score === 'number' ? p.overall_score : 0
    const status = typeof p.status === 'string' ? p.status : 'new'
    const id = typeof p.id === 'string' ? p.id : '(unknown)'
    bodyLines.push(`- score ${score}/100 · status ${status} · id ${id}`)
  }
  bodyLines.push('')
  bodyLines.push(`Top content angles:`)
  for (const d of drafts.slice(0, 8)) {
    bodyLines.push(`- ${String(d.angle ?? '').slice(0, 90)}`)
  }

  const email = renderAdminNotificationEmail({
    title: `Prospect watch daily digest (${day})`,
    appUrl,
    ctaHref: `${appUrl}/settings/prospects`,
    ctaLabel: 'Review queue',
    lines: bodyLines,
  })

  const results = await Promise.allSettled(
    tos.map((toEmail) =>
      sendEmailDeduped(admin, {
        dedupeKey: `prospect_watch:digest:${day}:${toEmail}`,
        userId: null,
        toEmail,
        fromEmail: from,
        replyTo: getResendReplyToEmail(),
        subject: email.subject,
        html: email.html,
        text: email.text,
        kind: 'internal',
        template: 'prospect_watch_daily_digest',
        tags: [{ name: 'kind', value: 'internal' }, { name: 'type', value: 'prospect_watch_digest' }],
        meta: { day, prospectCount, contentCount },
      })
    )
  )

  void captureServerEvent({ distinctId: 'prospect_watch', event: 'founder_digest_sent', properties: { day, prospectCount, contentCount } })

  return {
    status: 'ok' as const,
    summary: { recipients: tos.length, deliveredAttempts: results.length, prospectCount, contentCount, enabled: { prospects: prospectDailyDigestEnabled(), content: contentDailyDigestEnabled() } },
  }
}

