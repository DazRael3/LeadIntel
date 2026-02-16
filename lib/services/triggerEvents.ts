import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getCompositeTriggerEventsProvider, type RawTriggerEvent, type ProviderInput } from '@/lib/events/provider'
import { classifyAndScoreEvents, type TriggerEventCategory, type TriggerEvent as EngineEvent } from '@/lib/services/trigger-events/engine'
import { IS_DEV, logError, logWarn } from '@/lib/logging/logger'

export interface TriggerEventInput {
  userId: string
  leadId: string | null
  companyName: string | null
  companyDomain: string | null
  correlationId?: string
}

export interface TriggerEventCandidate {
  headline: string
  description: string
  sourceUrl: string
  detectedAt: string // ISO
  eventType: string
}

type TriggerEventRow = {
  id: string
  user_id: string
  lead_id: string | null
  company_name: string | null
  company_domain: string | null
  company_url: string | null
  event_type: string | null
  event_description: string | null
  source_url: string | null
  headline: string | null
  detected_at: string | null
  created_at: string | null
}

function getClient(): ReturnType<typeof createSupabaseAdminClient> {
  // Admin client is used so this service can be called from cron as well.
  return createSupabaseAdminClient()
}

function normalizeUrl(value: string): string | null {
  const s = value.trim()
  if (!s) return null
  try {
    // eslint-disable-next-line no-new -- validation only
    new URL(s)
    return s
  } catch {
    return null
  }
}

function toDbEventType(category: TriggerEventCategory): string {
  if (category === 'funding') return 'funding'
  if (category === 'product_launch') return 'product_launch'
  if (category === 'market_expansion') return 'expansion'
  if (category === 'partnership') return 'partnership'
  if (category === 'leadership_change') return 'new_hires'
  // Keep within existing allowed event types; fall back to expansion.
  return 'expansion'
}

function toEngineEvent(e: RawTriggerEvent): EngineEvent | null {
  const title = (e.headline || e.title || '').trim()
  const url = normalizeUrl(e.sourceUrl)
  if (!title || !url) return null
  const publishedAt =
    e.occurredAt && Number.isFinite(e.occurredAt.getTime()) ? e.occurredAt.toISOString() : new Date().toISOString()
  return {
    id: `${title.toLowerCase()}::${url.toLowerCase()}::${publishedAt}`,
    source: (e.sourceName ?? 'unknown').toString(),
    title,
    url,
    publishedAt,
    summary: (e.description ?? '').toString().trim() || null,
  }
}

function toCandidate(e: RawTriggerEvent): TriggerEventCandidate | null {
  const headline = (e.headline || e.title || '').trim()
  const url = normalizeUrl(e.sourceUrl)
  if (!headline || !url) return null
  const desc = (e.description ?? '').toString().trim() || headline
  const detectedAt = e.occurredAt && Number.isFinite(e.occurredAt.getTime()) ? e.occurredAt.toISOString() : new Date().toISOString()
  const engine = toEngineEvent(e)
  const scored = engine ? classifyAndScoreEvents([engine])[0] : null
  const eventType = scored ? toDbEventType(scored.category) : 'expansion'
  return { headline, description: desc, sourceUrl: url, detectedAt, eventType }
}

export async function ingestRealTriggerEvents(input: TriggerEventInput): Promise<{ created: number }> {
  const provider = getCompositeTriggerEventsProvider({
    ctx: {
      userId: input.userId,
      leadId: input.leadId ?? undefined,
      companyDomain: input.companyDomain ?? null,
      companyName: input.companyName ?? null,
      correlationId: input.correlationId,
    },
  })

  try {
    const providerInput: ProviderInput = { companyName: input.companyName, companyDomain: input.companyDomain }
    const raw = await provider(providerInput)
    const candidates = (raw ?? []).map(toCandidate).filter((c): c is TriggerEventCandidate => Boolean(c))
    if (candidates.length === 0) return { created: 0 }

    const client = getClient()

    // Fetch existing events for this company (recent window) to avoid flooding duplicates.
    // NOTE: Without a DB-level unique constraint, we dedupe at the application layer.
    const q = client
      .from('trigger_events')
      .select('source_url, headline, detected_at')
      .eq('user_id', input.userId)
      .limit(500)

    const { data: existing } = input.companyDomain
      ? await q.eq('company_domain', input.companyDomain)
      : input.companyName
        ? await q.eq('company_name', input.companyName)
        : await q

    const existingUrls = new Set<string>()
    const existingTitleKeys = new Set<string>()
    for (const row of (existing ?? []) as Array<{ source_url?: string | null; headline?: string | null; detected_at?: string | null }>) {
      if (row.source_url) existingUrls.add(row.source_url.toLowerCase())
      if (row.headline) existingTitleKeys.add(row.headline.toLowerCase())
    }

    const unique = new Map<string, TriggerEventCandidate>()
    for (const c of candidates) {
      const urlKey = c.sourceUrl.toLowerCase()
      if (existingUrls.has(urlKey)) continue
      if (existingTitleKeys.has(c.headline.toLowerCase())) continue
      unique.set(urlKey, c)
    }

    const toInsert = Array.from(unique.values()).slice(0, 30)
    if (toInsert.length === 0) return { created: 0 }

    const companyUrl = input.companyDomain ? `https://${input.companyDomain}` : null

    const rows = toInsert.map((c) => ({
      user_id: input.userId,
      lead_id: input.leadId,
      company_name: input.companyName,
      company_domain: input.companyDomain,
      company_url: companyUrl,
      event_type: c.eventType,
      headline: c.headline,
      event_description: c.description,
      source_url: c.sourceUrl,
      detected_at: c.detectedAt,
    }))

    const { error } = await client.from('trigger_events').insert(rows)
    if (error) {
      logError({
        scope: 'trigger-events',
        message: 'ingest.insert_failed',
        error: IS_DEV ? error.message : undefined,
        userId: input.userId,
        correlationId: input.correlationId,
      })
      return { created: 0 }
    }

    return { created: rows.length }
  } catch (err) {
    logError({
      scope: 'trigger-events',
      message: 'ingest.failed',
      error: IS_DEV ? (err instanceof Error ? err.message : String(err)) : undefined,
      userId: input.userId,
      correlationId: input.correlationId,
    })
    return { created: 0 }
  }
}

export async function seedDemoTriggerEventsIfEmpty(input: TriggerEventInput): Promise<{ created: number }> {
  const client = getClient()
  try {
    const base = client
      .from('trigger_events')
      .select('id')
      .eq('user_id', input.userId)
      .limit(1)

    const { data: existing } = input.companyDomain
      ? await base.eq('company_domain', input.companyDomain)
      : input.companyName
        ? await base.eq('company_name', input.companyName)
        : await base

    if (Array.isArray(existing) && existing.length > 0) return { created: 0 }

    const now = new Date().toISOString()
    const companyUrl = input.companyDomain ? `https://${input.companyDomain}` : null
    const name = input.companyName ?? input.companyDomain ?? 'This company'
    const sourceUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://leadintel.com'

    const rows = [
      {
        user_id: input.userId,
        lead_id: input.leadId,
        company_name: input.companyName,
        company_domain: input.companyDomain,
        company_url: companyUrl,
        event_type: 'funding',
        headline: `Demo event: ${name} announces fresh funding`,
        event_description: 'Demo trigger event generated for first-time onboarding. Disable via ENABLE_DEMO_TRIGGER_EVENTS.',
        source_url: sourceUrl,
        detected_at: now,
      },
      {
        user_id: input.userId,
        lead_id: input.leadId,
        company_name: input.companyName,
        company_domain: input.companyDomain,
        company_url: companyUrl,
        event_type: 'expansion',
        headline: `Demo event: ${name} expands go-to-market team`,
        event_description: 'Demo trigger event generated for first-time onboarding. Disable via ENABLE_DEMO_TRIGGER_EVENTS.',
        source_url: sourceUrl,
        detected_at: now,
      },
    ]

    const { error } = await client.from('trigger_events').insert(rows)
    if (error) {
      logWarn({
        scope: 'trigger-events',
        message: 'demo_seed.insert_failed',
        userId: input.userId,
        correlationId: input.correlationId,
        supabaseMessage: IS_DEV ? error.message : undefined,
      })
      return { created: 0 }
    }
    return { created: rows.length }
  } catch (err) {
    logWarn({
      scope: 'trigger-events',
      message: 'demo_seed.failed',
      userId: input.userId,
      correlationId: input.correlationId,
      error: IS_DEV ? (err instanceof Error ? err.message : String(err)) : undefined,
    })
    return { created: 0 }
  }
}

export async function hasAnyTriggerEvents(input: TriggerEventInput): Promise<boolean> {
  const client = getClient()
  const base = client
    .from('trigger_events')
    .select('id')
    .eq('user_id', input.userId)
    .limit(1)

  const { data } = input.leadId
    ? await base.eq('lead_id', input.leadId)
    : input.companyDomain
      ? await base.eq('company_domain', input.companyDomain)
      : input.companyName
        ? await base.eq('company_name', input.companyName)
        : await base

  return Array.isArray(data) && data.length > 0
}

export async function getLatestTriggerEvent(input: TriggerEventInput): Promise<TriggerEventRow | null> {
  const client = getClient()
  const base = client
    .from('trigger_events')
    .select('id, user_id, lead_id, company_name, company_domain, company_url, event_type, event_description, source_url, headline, detected_at, created_at')
    .eq('user_id', input.userId)
    .order('detected_at', { ascending: false })
    .limit(1)

  const { data, error } = input.leadId
    ? await base.eq('lead_id', input.leadId)
    : input.companyDomain
      ? await base.eq('company_domain', input.companyDomain)
      : input.companyName
        ? await base.eq('company_name', input.companyName)
        : await base

  if (error) return null
  const row = (data?.[0] ?? null) as TriggerEventRow | null
  return row
}

