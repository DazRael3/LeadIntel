import crypto from 'crypto'
import {
  composeProviders,
  getConfiguredProviderSpecs,
  logTriggerProvider,
  withProviderLogging,
  type ProviderInput,
  type ProviderLogContext,
  type RawTriggerEvent,
  type TriggerEventsProviderSpec,
} from '@/lib/events/provider'

export type TriggerEvent = {
  id: string
  source: string // providerName, e.g. "newsapi"
  title: string
  url: string | null
  publishedAt: string // ISO
  summary?: string | null
  // Provider-specific payload should never be sent to clients in full.
  raw?: unknown
}

export type TriggerEventProvider = {
  name: string
  fetchEvents(params: {
    companyName: string
    companyDomain: string | null
    userId: string
    correlationId: string
  }): Promise<TriggerEvent[]>
}

export type TriggerEventCategory =
  | 'funding'
  | 'leadership_change'
  | 'product_launch'
  | 'market_expansion'
  | 'partnership'
  | 'regulatory'
  | 'layoffs'
  | 'earnings'
  | 'other'

export type ScoredTriggerEvent = TriggerEvent & {
  category: TriggerEventCategory
  score: number // 0-100
  sentiment?: 'positive' | 'negative' | 'neutral'
}

function sha1Id(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex')
}

function toIso(d: Date | null | undefined): string {
  if (d && Number.isFinite(d.getTime())) return d.toISOString()
  return new Date().toISOString()
}

function safeText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function rawToTriggerEvent(providerName: string, e: RawTriggerEvent): TriggerEvent | null {
  const title = safeText(e.title || e.headline)
  const url = safeText(e.sourceUrl) || null
  if (!title) return null
  const publishedAt = toIso(e.occurredAt ?? null)
  const id = sha1Id(`${providerName}::${title.toLowerCase()}::${(url ?? '').toLowerCase()}::${publishedAt}`)
  return {
    id,
    source: providerName,
    title,
    url,
    publishedAt,
    summary: safeText(e.description) || null,
  }
}

function dedupeAndSort(events: TriggerEvent[]): TriggerEvent[] {
  const seen = new Set<string>()
  const out: TriggerEvent[] = []
  for (const e of events) {
    const urlKey = (e.url ?? '').trim().toLowerCase()
    const titleKey = e.title.trim().toLowerCase()
    const key = urlKey ? `u:${urlKey}` : `t:${titleKey}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  return out
}

function scoreRecency(publishedAtIso: string): number {
  const ts = Date.parse(publishedAtIso)
  if (!Number.isFinite(ts)) return 0
  const ageMs = Date.now() - ts
  const dayMs = 24 * 60 * 60 * 1000
  const days = ageMs / dayMs
  if (days <= 1) return 15
  if (days <= 3) return 10
  if (days <= 7) return 6
  if (days <= 14) return 3
  return 0
}

function classifyOne(title: string, summary?: string | null): Pick<ScoredTriggerEvent, 'category' | 'score' | 'sentiment'> {
  const text = `${title} ${(summary ?? '')}`.toLowerCase()

  const has = (re: RegExp) => re.test(text)

  let category: TriggerEventCategory = 'other'
  let base = 20
  let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral'

  if (has(/\b(series [abcde]|seed round|funding round|raises?|raised|investment|investor|valuation)\b/)) {
    category = 'funding'
    base = 85
    sentiment = 'positive'
  } else if (has(/\b(appointed|appoints|names|named)\b.*\b(ceo|cfo|cto|chief|president|vp|vice president)\b/) || has(/\b(ceo|cfo|cto)\b.*\b(steps down|resigns|depart(s|ed)?)\b/)) {
    category = 'leadership_change'
    base = 75
  } else if (has(/\b(launches|launched|introduces|released|release|announces|unveils)\b.*\b(product|platform|feature|tool)\b/)) {
    category = 'product_launch'
    base = 70
    sentiment = 'positive'
  } else if (has(/\b(expands|expansion|opens|opening|new office|enter(s|ed)?)\b/)) {
    category = 'market_expansion'
    base = 60
    sentiment = 'positive'
  } else if (has(/\b(partnership|partners with|partnered with|strategic alliance|collaboration)\b/)) {
    category = 'partnership'
    base = 60
    sentiment = 'positive'
  } else if (has(/\b(regulatory|compliance|investigation|lawsuit|settlement|fine|sec|ftc)\b/)) {
    category = 'regulatory'
    base = 55
    sentiment = 'negative'
  } else if (has(/\b(layoffs?|job cuts?|restructuring|redundancies|reducing headcount)\b/)) {
    category = 'layoffs'
    base = 65
    sentiment = 'negative'
  } else if (has(/\b(earnings|quarterly results|q[1-4] results|guidance)\b/)) {
    category = 'earnings'
    base = 50
  }

  // Simple sentiment tweak
  if (sentiment === 'neutral') {
    if (has(/\b(beats|record|growth|surge|strong)\b/)) sentiment = 'positive'
    if (has(/\b(miss|weak|decline|downturn)\b/)) sentiment = 'negative'
  }

  return { category, score: base, sentiment }
}

export function classifyAndScoreEvents(events: TriggerEvent[]): ScoredTriggerEvent[] {
  return events
    .map((e) => {
      const cls = classifyOne(e.title, e.summary)
      const score = Math.max(0, Math.min(100, cls.score + scoreRecency(e.publishedAt)))
      return { ...e, category: cls.category, sentiment: cls.sentiment, score }
    })
    .sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt))
}

function toProviderInput(companyName: string, companyDomain: string | null): ProviderInput {
  return { companyName: companyName || null, companyDomain: companyDomain || null }
}

function makeProviderFromSpec(spec: TriggerEventsProviderSpec, ctx: ProviderLogContext): TriggerEventProvider {
  return {
    name: spec.name,
    fetchEvents: async ({ companyName, companyDomain }) => {
      const input = toProviderInput(companyName, companyDomain)
      const results = await withProviderLogging(spec.name, () => spec.run(input), ctx)
      return (results ?? []).map((r) => rawToTriggerEvent(spec.name, r)).filter((x): x is TriggerEvent => Boolean(x))
    },
  }
}

export async function getCompositeTriggerEvents(args: {
  companyName: string
  companyDomain: string | null
  userId: string
  correlationId: string
}): Promise<ScoredTriggerEvent[]> {
  const ctx: ProviderLogContext = {
    userId: args.userId,
    companyDomain: args.companyDomain,
    companyName: args.companyName,
    correlationId: args.correlationId,
  }

  const input = toProviderInput(args.companyName, args.companyDomain)
  const specs = getConfiguredProviderSpecs()

  const providerCounts: Record<string, number> = {}
  const enabledProviders: TriggerEventProvider[] = []

  for (const spec of specs) {
    providerCounts[spec.name] = 0

    if (!spec.enabled) {
      logTriggerProvider('debug', 'provider.skipped', { providerName: spec.name, reason: spec.skipReason ?? 'disabled', ...ctx })
      continue
    }
    const gate = spec.shouldRun?.(input) ?? { ok: true }
    if (!gate.ok) {
      logTriggerProvider('debug', 'provider.skipped', { providerName: spec.name, reason: gate.reason ?? 'low_specificity', ...ctx })
      continue
    }

    enabledProviders.push(makeProviderFromSpec(spec, ctx))
  }

  if (enabledProviders.length === 0) {
    logTriggerProvider('info', 'composite.summary', { totalEvents: 0, providerCounts, ...ctx })
    return []
  }

  const settled = await Promise.allSettled(enabledProviders.map((p) => p.fetchEvents({ ...args })))
  const merged: TriggerEvent[] = []
  for (let i = 0; i < settled.length; i++) {
    const prov = enabledProviders[i]
    const res = settled[i]
    if (res.status === 'fulfilled') {
      providerCounts[prov.name] = res.value.length
      merged.push(...res.value)
    } else {
      providerCounts[prov.name] = 0
      // provider.error log is handled by withProviderLogging; do not throw.
    }
  }

  const deduped = dedupeAndSort(merged)
  const scored = classifyAndScoreEvents(deduped)

  logTriggerProvider('info', 'composite.summary', { totalEvents: scored.length, providerCounts, ...ctx })
  return scored
}

