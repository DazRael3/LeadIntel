import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { classifyAndScoreEvents, type ScoredTriggerEvent, type TriggerEvent } from '@/lib/services/trigger-events/engine'
import { scoreLead, type LeadScoreResult } from '@/lib/services/lead-scoring'
import { IS_DEV, logInfo, logWarn, logError } from '@/lib/observability/logger'

export type DigestLead = {
  leadId: string
  companyName: string
  companyDomain: string | null
  companyUrl: string | null
  score: number
  scoreReasons: string[]
  whyNow: string[]
}

export type DigestSummary = {
  dateIso: string
  highPriorityLeadCount: number
  triggerEventCount: number
  leads: DigestLead[]
}

type LeadRow = {
  id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
  industry?: string | null
  created_at?: string | null
}

type TriggerRow = {
  lead_id: string | null
  headline?: string | null
  event_description?: string | null
  detected_at?: string | null
  created_at?: string | null
  source_url?: string | null
}

type PitchRow = { lead_id: string | null; created_at: string }
type EmailLogRow = { lead_id: string | null; created_at: string; status?: string | null }

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function safeIso(value: string | null | undefined): string {
  const s = (value ?? '').trim()
  if (!s) return new Date().toISOString()
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString()
}

function toEngineEvents(rows: TriggerRow[], leadId: string): TriggerEvent[] {
  const out: TriggerEvent[] = []
  for (const r of rows) {
    if (r.lead_id !== leadId) continue
    const title = (r.headline ?? r.event_description ?? '').trim()
    if (!title) continue
    out.push({
      id: `${leadId}:${title.toLowerCase()}:${safeIso(r.detected_at ?? r.created_at)}`,
      source: 'db',
      title,
      url: typeof r.source_url === 'string' ? r.source_url : null,
      publishedAt: safeIso(r.detected_at ?? r.created_at),
      summary: typeof r.event_description === 'string' ? r.event_description : null,
    })
  }
  return out
}

function pickWhyNow(events: ScoredTriggerEvent[], max = 3): string[] {
  return events
    .filter((e) => e.score >= 60)
    .slice(0, max)
    .map((e) => `${e.publishedAt.slice(0, 10)}: ${e.title} [${e.category}, score=${e.score}]`)
}

export async function buildUserDigest(args: {
  userId: string
  correlationId: string
}): Promise<{ ok: true; summary: DigestSummary } | { ok: false; reason: string }> {
  const supabase = createSupabaseAdminClient()
  const nowIso = new Date().toISOString()

  try {
    // User settings for ICP (best-effort).
    let userSettings: { what_you_sell?: string | null; ideal_customer?: string | null } | null = null
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('what_you_sell, ideal_customer')
        .eq('user_id', args.userId)
        .maybeSingle()
      userSettings = (data ?? null) as any
    } catch {
      userSettings = null
    }

    // Leads (best-effort; tolerate schema variations).
    let leads: LeadRow[] = []
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, company_name, company_domain, company_url, industry, created_at')
        .eq('user_id', args.userId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (!error) leads = (data ?? []) as LeadRow[]
      else {
        const { data: minimal } = await supabase
          .from('leads')
          .select('id, company_name, company_domain, company_url, created_at')
          .eq('user_id', args.userId)
          .order('created_at', { ascending: false })
          .limit(50)
        leads = (minimal ?? []) as LeadRow[]
      }
    } catch {
      leads = []
    }

    if (leads.length === 0) {
      logInfo({ scope: 'digest', message: 'digest.skip_no_leads', userId: args.userId, correlationId: args.correlationId })
      return { ok: false, reason: 'no_leads' }
    }

    const leadIds = leads.map((l) => l.id)
    const sinceIso = daysAgoIso(7)

    // Trigger events from DB (recent window)
    let triggerRows: TriggerRow[] = []
    try {
      const { data } = await supabase
        .from('trigger_events')
        .select('lead_id, headline, event_description, detected_at, created_at, source_url')
        .eq('user_id', args.userId)
        .gte('detected_at', sinceIso)
        .in('lead_id', leadIds)
        .order('detected_at', { ascending: false })
        .limit(500)
      triggerRows = (data ?? []) as TriggerRow[]
    } catch {
      triggerRows = []
    }

    // Pitches (recent)
    const pitchesByLead = new Map<string, Date[]>()
    try {
      const { data } = await supabase
        .from('pitches')
        .select('lead_id, created_at')
        .eq('user_id', args.userId)
        .gte('created_at', sinceIso)
        .limit(500)
      for (const r of (data ?? []) as PitchRow[]) {
        if (!r.lead_id) continue
        const ts = Date.parse(r.created_at)
        if (!Number.isFinite(ts)) continue
        const arr = pitchesByLead.get(r.lead_id) ?? []
        arr.push(new Date(ts))
        pitchesByLead.set(r.lead_id, arr)
      }
    } catch {
      // ignore
    }

    // Email logs (recent; best-effort)
    const emailsByLead = new Map<string, Date[]>()
    try {
      const { data } = await supabase
        .from('email_logs')
        .select('lead_id, created_at, status')
        .eq('user_id', args.userId)
        .gte('created_at', sinceIso)
        .limit(500)
      for (const r of (data ?? []) as EmailLogRow[]) {
        if (!r.lead_id) continue
        if (r.status && r.status !== 'sent') continue
        const ts = Date.parse(r.created_at)
        if (!Number.isFinite(ts)) continue
        const arr = emailsByLead.get(r.lead_id) ?? []
        arr.push(new Date(ts))
        emailsByLead.set(r.lead_id, arr)
      }
    } catch {
      // schema may not have email_logs or columns; ignore
    }

    const scoredLeads: Array<{ lead: LeadRow; score: LeadScoreResult; events: ScoredTriggerEvent[] }> = []
    let totalTriggerEvents = 0

    for (const lead of leads) {
      const engineEvents = toEngineEvents(triggerRows, lead.id)
      const scoredEvents = classifyAndScoreEvents(engineEvents)
      totalTriggerEvents += scoredEvents.length

      const pitchDates = pitchesByLead.get(lead.id) ?? []
      const emailDates = emailsByLead.get(lead.id) ?? []
      const lastInteraction = [...pitchDates, ...emailDates].sort((a, b) => b.getTime() - a.getTime())[0] ?? null

      const result = scoreLead({
        lead: {
          id: lead.id,
          company_name: lead.company_name,
          company_domain: lead.company_domain,
          company_url: lead.company_url,
          industry: (lead as any).industry ?? null,
        },
        events: scoredEvents,
        userSignals: {
          isWatchlisted: false,
          unlockedCount: 0,
          pitchesGenerated: pitchDates.length,
          emailsSent: emailDates.length,
          lastInteractionAt: lastInteraction,
        },
        userSettings: {
          whatYouSell: userSettings?.what_you_sell ?? undefined,
          idealCustomer: userSettings?.ideal_customer ?? undefined,
        },
      })

      scoredLeads.push({ lead, score: result, events: scoredEvents })
    }

    scoredLeads.sort((a, b) => b.score.score - a.score.score)

    const top = scoredLeads.slice(0, 5).map((x) => ({
      leadId: x.lead.id,
      companyName: x.lead.company_name || x.lead.company_domain || x.lead.company_url || 'Unknown',
      companyDomain: x.lead.company_domain ?? null,
      companyUrl: x.lead.company_url ?? null,
      score: x.score.score,
      scoreReasons: x.score.reasons,
      whyNow: pickWhyNow(x.events, 3),
    }))

    const highPriorityLeadCount = top.filter((l) => l.score >= 70).length
    const triggerEventCount = triggerRows.length

    // Only send when meaningful.
    if (highPriorityLeadCount === 0 && triggerEventCount < 3) {
      logInfo({
        scope: 'digest',
        message: 'digest.skip_not_meaningful',
        userId: args.userId,
        correlationId: args.correlationId,
        leadCount: leads.length,
        triggerEventCount,
        highPriorityLeadCount,
      })
      return { ok: false, reason: 'not_meaningful' }
    }

    const summary: DigestSummary = {
      dateIso: nowIso.slice(0, 10),
      highPriorityLeadCount,
      triggerEventCount,
      leads: top,
    }

    logInfo({
      scope: 'digest',
      message: 'digest.built',
      userId: args.userId,
      correlationId: args.correlationId,
      leadCount: leads.length,
      highPriorityLeadCount,
      triggerEventCount,
      topScore: top[0]?.score ?? 0,
    })

    return { ok: true, summary }
  } catch (err) {
    logError({
      scope: 'digest',
      message: 'digest.build_failed',
      userId: args.userId,
      correlationId: args.correlationId,
      error: IS_DEV ? String(err) : undefined,
    })
    return { ok: false, reason: 'error' }
  }
}

