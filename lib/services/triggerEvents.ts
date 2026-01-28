import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getTriggerEventsProvider } from '@/lib/events/provider'

export interface TriggerEventInput {
  userId: string
  leadId: string | null
  companyName: string | null
  companyDomain: string | null
}

export interface TriggerEventCandidate {
  headline: string
  description: string
  sourceUrl: string
  detectedAt: string // ISO
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

function normalizeCandidate(c: TriggerEventCandidate): TriggerEventCandidate | null {
  const headline = c.headline.trim()
  const description = c.description.trim()
  const sourceUrl = c.sourceUrl.trim()
  const detectedAt = c.detectedAt.trim()
  if (!headline || !description || !sourceUrl || !detectedAt) return null
  // Very basic URL validation; keep conservative.
  try {
    // eslint-disable-next-line no-new -- validation only
    new URL(sourceUrl)
  } catch {
    return null
  }
  // ISO validation (best-effort)
  const t = Date.parse(detectedAt)
  if (!Number.isFinite(t)) return null
  return { headline, description, sourceUrl, detectedAt: new Date(t).toISOString() }
}

function dedupeKey(c: TriggerEventCandidate): string {
  return `${c.headline}::${c.detectedAt}`
}

export async function ingestRealTriggerEvents(input: TriggerEventInput): Promise<{ created: number }> {
  const { kind, provider } = getTriggerEventsProvider()
  if (kind === 'none') return { created: 0 }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[trigger-events] ingestRealTriggerEvents', {
      userId: input.userId,
      companyDomain: input.companyDomain,
      provider: kind,
    })
  }

  try {
    const raw = await provider.fetchEvents(input)
    const normalized = (raw ?? []).map(normalizeCandidate).filter((c): c is TriggerEventCandidate => Boolean(c))
    if (normalized.length === 0) return { created: 0 }

    const client = getClient()

    // Fetch existing events for this company (recent window) to avoid flooding duplicates.
    // NOTE: Without a DB-level unique constraint, we dedupe at the application layer.
    const q = client
      .from('trigger_events')
      .select('headline, detected_at')
      .eq('user_id', input.userId)
      .limit(250)

    const { data: existing } = input.companyDomain
      ? await q.eq('company_domain', input.companyDomain)
      : input.companyName
        ? await q.eq('company_name', input.companyName)
        : await q

    const existingKeys = new Set<string>()
    for (const row of (existing ?? []) as Array<{ headline?: string | null; detected_at?: string | null }>) {
      if (!row.headline || !row.detected_at) continue
      existingKeys.add(`${row.headline}::${new Date(row.detected_at).toISOString()}`)
    }

    const unique = new Map<string, TriggerEventCandidate>()
    for (const c of normalized) {
      const k = dedupeKey(c)
      if (!existingKeys.has(k)) unique.set(k, c)
    }

    const toInsert = Array.from(unique.values()).slice(0, 25)
    if (toInsert.length === 0) return { created: 0 }

    const companyUrl = input.companyDomain ? `https://${input.companyDomain}` : null

    const rows = toInsert.map((c) => ({
      user_id: input.userId,
      lead_id: input.leadId,
      company_name: input.companyName,
      company_domain: input.companyDomain,
      company_url: companyUrl,
      event_type: 'expansion',
      headline: c.headline,
      event_description: c.description,
      source_url: c.sourceUrl,
      detected_at: c.detectedAt,
    }))

    const { error } = await client.from('trigger_events').insert(rows)
    if (error) {
      console.error('[trigger-events] ingest insert failed', { message: error.message })
      return { created: 0 }
    }

    return { created: rows.length }
  } catch (err) {
    console.error('[trigger-events] ingest failed', { message: err instanceof Error ? err.message : 'unknown' })
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
      console.error('[trigger-events] seed demo insert failed', { message: error.message })
      return { created: 0 }
    }
    return { created: rows.length }
  } catch (err) {
    console.error('[trigger-events] seed demo failed', { message: err instanceof Error ? err.message : 'unknown' })
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

