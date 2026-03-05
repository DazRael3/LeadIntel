import type { SupabaseClient } from '@supabase/supabase-js'
import type { SignalEvent, ScoreExplainability } from '@/lib/domain/explainability'
import { safeExternalLink } from '@/lib/domain/explainability'
import { classifyAndScoreEvents, type TriggerEvent as EngineEvent } from '@/lib/services/trigger-events/engine'
import { scoreLeadDetailed } from '@/lib/services/lead-scoring'

type DbLeadRow = {
  id: string
  user_id: string
  company_name: string | null
  company_domain: string | null
  company_url: string | null
  created_at: string | null
  updated_at: string | null
}

type DbTriggerRow = {
  id: string
  lead_id: string | null
  event_type: string | null
  headline: string | null
  event_description: string | null
  source_url: string | null
  detected_at: string | null
  created_at: string | null
}

type DbPitchRow = { created_at: string | null }
type DbEmailLogRow = { created_at: string | null; status: string | null }
type DbWatchlistRow = { id: string }
type DbUserSettingsRow = { what_you_sell: string | null; ideal_customer: string | null }

export type ExplainabilityWindow = '7d' | '30d' | '90d' | 'all'
export type ExplainabilitySort = 'recent' | 'confidence'

export type AccountExplainability = {
  account: {
    id: string
    name: string | null
    domain: string | null
    url: string | null
    createdAt: string | null
    updatedAt: string | null
  }
  signals: SignalEvent[]
  scoreExplainability: ScoreExplainability
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function isIsoString(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const ts = Date.parse(value)
  return Number.isFinite(ts)
}

function reasonToHuman(code: string): string | null {
  const c = code.trim().toLowerCase()
  const map: Record<string, string> = {
    recent_funding: 'Recent funding signal.',
    leadership_change: 'Recent leadership change signal.',
    product_launch: 'Recent product launch signal.',
    market_expansion: 'Recent expansion signal.',
    partnership: 'Recent partnership signal.',
    layoffs: 'Recent layoffs signal.',
    regulatory: 'Recent regulatory/compliance signal.',
    earnings: 'Recent earnings signal.',
    high_signal_event: 'High-signal event detected.',
    multiple_recent_events: 'Multiple recent signals detected.',
    recent_event: 'Recent signal detected.',
    watchlisted: 'You’re monitoring this account.',
    unlocked: 'You’ve recently engaged with this account.',
    pitches_generated: 'You’ve generated outreach for this account.',
    emails_sent: 'You’ve sent outreach to this account.',
    recent_interaction_24h: 'You interacted with this account in the last 24 hours.',
    recent_interaction_7d: 'You interacted with this account in the last 7 days.',
    icp_defined: 'Your ICP is defined.',
    solution_defined: 'Your offering is defined.',
    industry_matches_icp: 'Industry matches your ICP.',
  }
  return map[c] ?? null
}

function toEngineEvents(rows: DbTriggerRow[], leadId: string): EngineEvent[] {
  const out: EngineEvent[] = []
  for (const r of rows) {
    if (r.lead_id !== leadId) continue
    const title = (r.headline ?? r.event_description ?? r.event_type ?? '').trim()
    const detectedAt = r.detected_at ?? r.created_at
    if (!title || !isIsoString(detectedAt)) continue
    out.push({
      id: r.id,
      source: 'db',
      title,
      url: safeExternalLink(r.source_url),
      publishedAt: detectedAt,
      summary: (r.event_description ?? '').trim() || null,
    })
  }
  return out
}

export async function getAccountExplainability(args: {
  supabase: SupabaseClient
  userId: string
  accountId: string
  window?: ExplainabilityWindow
  type?: string | null
  sort?: ExplainabilitySort
  limit?: number
}): Promise<AccountExplainability | null> {
  const window = args.window ?? '30d'
  const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 50)))

  const leadRes = await args.supabase
    .from('leads')
    .select('id, user_id, company_name, company_domain, company_url, created_at, updated_at')
    .eq('id', args.accountId)
    .eq('user_id', args.userId)
    .maybeSingle()

  if (leadRes.error || !leadRes.data) return null
  const lead = leadRes.data as unknown as DbLeadRow

  let triggerQ = args.supabase
    .from('trigger_events')
    .select('id, lead_id, event_type, headline, event_description, source_url, detected_at, created_at')
    .eq('user_id', args.userId)
    .eq('lead_id', args.accountId)

  if (window !== 'all') {
    const days = window === '7d' ? 7 : window === '90d' ? 90 : 30
    triggerQ = triggerQ.gte('detected_at', daysAgoIso(days))
  }

  if (args.type && args.type.trim()) {
    triggerQ = triggerQ.eq('event_type', args.type.trim())
  }

  // Sort: confidence only if column exists (not currently); fall back to recency.
  triggerQ = triggerQ.order('detected_at', { ascending: false }).limit(limit)

  const triggersRes = await triggerQ
  const triggerRows = (triggersRes.data ?? []) as unknown as DbTriggerRow[]

  const signals: SignalEvent[] = triggerRows
    .map((r) => {
      const detectedAt = r.detected_at ?? r.created_at
      if (!isIsoString(detectedAt)) return null
      const title = (r.headline ?? r.event_description ?? r.event_type ?? '').trim()
      if (!title) return null
      return {
        id: r.id,
        type: (r.event_type ?? 'unknown').toString(),
        title,
        summary: (r.event_description ?? '').trim() || null,
        occurredAt: null,
        detectedAt,
        sourceName: null,
        sourceUrl: safeExternalLink(r.source_url),
        confidence: null,
      } satisfies SignalEvent
    })
    .filter((x): x is SignalEvent => Boolean(x))

  // Score explainability (deterministic; computed from stored signals + user activity).
  const [watchlistRes, pitchesRes, emailLogsRes, userSettingsRes] = await Promise.all([
    args.supabase.from('watchlist').select('id').eq('user_id', args.userId).eq('lead_id', args.accountId).limit(1),
    args.supabase
      .from('pitches')
      .select('created_at')
      .eq('user_id', args.userId)
      .eq('lead_id', args.accountId)
      .order('created_at', { ascending: false })
      .limit(50),
    args.supabase
      .from('email_logs')
      .select('created_at, status')
      .eq('user_id', args.userId)
      .eq('lead_id', args.accountId)
      .order('created_at', { ascending: false })
      .limit(200),
    args.supabase
      .from('user_settings')
      .select('what_you_sell, ideal_customer')
      .eq('user_id', args.userId)
      .maybeSingle(),
  ])

  const isWatchlisted = Array.isArray(watchlistRes.data) && watchlistRes.data.length > 0
  const pitchDates = ((pitchesRes.data ?? []) as unknown as DbPitchRow[])
    .map((r) => (isIsoString(r.created_at) ? new Date(r.created_at) : null))
    .filter((d): d is Date => Boolean(d))

  const emailDates = ((emailLogsRes.data ?? []) as unknown as DbEmailLogRow[])
    .filter((r) => (r.status ?? '') === 'sent' || (r.status ?? '') === null)
    .map((r) => (isIsoString(r.created_at) ? new Date(r.created_at) : null))
    .filter((d): d is Date => Boolean(d))

  const lastInteractionAt =
    [...pitchDates, ...emailDates].sort((a, b) => b.getTime() - a.getTime())[0] ?? null

  const userSettings = (userSettingsRes.data ?? null) as unknown as DbUserSettingsRow | null

  const engineEvents = toEngineEvents(triggerRows, lead.id)
  const scoredEvents = classifyAndScoreEvents(engineEvents)

  const scored = scoreLeadDetailed({
    lead: {
      id: lead.id,
      company_name: lead.company_name,
      company_domain: lead.company_domain,
      company_url: lead.company_url,
    },
    events: scoredEvents,
    userSignals: {
      isWatchlisted,
      unlockedCount: 0,
      pitchesGenerated: pitchDates.length,
      emailsSent: emailDates.length,
      lastInteractionAt,
    },
    userSettings: {
      whatYouSell: userSettings?.what_you_sell ?? undefined,
      idealCustomer: userSettings?.ideal_customer ?? undefined,
    },
  })

  const reasons = scored.reasons.map((code) => reasonToHuman(code)).filter((x): x is string => Boolean(x))
  const breakdown =
    scored.breakdown && scored.breakdown.length > 0
      ? scored.breakdown.map((b) => ({ label: b.label, points: b.points }))
      : undefined

  const scoreExplainability: ScoreExplainability = {
    score: scored.score,
    reasons,
    ...(breakdown ? { breakdown } : {}),
    ...(isIsoString(lead.updated_at) ? { updatedAt: lead.updated_at } : {}),
  }

  return {
    account: {
      id: lead.id,
      name: lead.company_name,
      domain: lead.company_domain,
      url: lead.company_url,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
    },
    signals,
    scoreExplainability,
  }
}

