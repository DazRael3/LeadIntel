import Parser from 'rss-parser'

export type TriggerEventsProviderName = 'none' | 'newsapi' | 'finnhub' | 'gdelt' | 'crunchbase' | 'rss' | 'custom'

export type RawTriggerEvent = {
  title: string
  headline: string
  description?: string | null
  sourceName?: string | null
  sourceUrl: string
  companyName?: string | null
  companyDomain?: string | null
  occurredAt?: Date | null
}

export type ProviderInput = {
  companyName?: string | null
  companyDomain?: string | null
}

export type TriggerEventsProvider = (input: ProviderInput) => Promise<RawTriggerEvent[]>

export type ProviderLogContext = {
  userId?: string
  leadId?: string
  companyDomain?: string | null
  companyName?: string | null
  correlationId?: string
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function isDebugLoggingEnabled(): boolean {
  const v = (process.env.TRIGGER_EVENTS_DEBUG_LOGGING ?? '').trim().toLowerCase()
  return v === 'true' || v === '1'
}

export function logTriggerProvider(level: LogLevel, message: string, data: Record<string, unknown> = {}): void {
  const enabled = isDebugLoggingEnabled()
  if (!enabled && (level === 'debug' || level === 'info')) return

  const method: 'log' | 'info' | 'warn' | 'error' = level === 'debug' ? 'log' : level
  // Emit a single JSON-like object so Vercel logs are grep-friendly.
  console[method]({
    scope: 'trigger-events',
    message,
    ...data,
  })
}

export async function withProviderLogging(
  providerName: string,
  fn: () => Promise<RawTriggerEvent[]>,
  ctx: ProviderLogContext
): Promise<RawTriggerEvent[]> {
  const start = Date.now()
  try {
    logTriggerProvider('debug', 'provider.start', { providerName, ...ctx })
    const results = await fn()
    logTriggerProvider('info', 'provider.success', {
      providerName,
      count: results.length,
      durationMs: Date.now() - start,
      ...ctx,
    })
    return results
  } catch (err) {
    logTriggerProvider('warn', 'provider.error', {
      providerName,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
      ...ctx,
    })
    return []
  }
}

function safeUrl(value: string | null | undefined): string | null {
  const s = (value ?? '').trim()
  if (!s) return null
  try {
    // eslint-disable-next-line no-new -- validation only
    new URL(s)
    return s
  } catch {
    return null
  }
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function getMaxPerProvider(): number {
  const raw = process.env.TRIGGER_EVENTS_MAX_PER_PROVIDER
  const parsed = raw ? Number.parseInt(raw, 10) : NaN
  return clampInt(Number.isFinite(parsed) ? parsed : 10, 1, 25)
}

export function getConfiguredProviderNames(): TriggerEventsProviderName[] {
  const allowed = new Set<TriggerEventsProviderName>(['none', 'newsapi', 'finnhub', 'gdelt', 'crunchbase', 'rss', 'custom'])
  const multi = (process.env.TRIGGER_EVENTS_PROVIDERS ?? '').trim().toLowerCase()
  const legacy = (process.env.TRIGGER_EVENTS_PROVIDER ?? 'none').trim().toLowerCase()

  const rawList = multi
    ? multi.split(',').map((s) => s.trim()).filter(Boolean)
    : [legacy]

  const names = rawList.filter((n): n is TriggerEventsProviderName => allowed.has(n as TriggerEventsProviderName))
  return names.length > 0 ? names : ['none']
}

export function composeProviders(providers: TriggerEventsProvider[]): TriggerEventsProvider {
  return async (input: ProviderInput) => {
    const settled = await Promise.allSettled(providers.map((p) => p(input)))
    const merged: RawTriggerEvent[] = []
    for (const r of settled) {
      if (r.status === 'fulfilled') merged.push(...r.value)
    }

    // Deduplicate primarily by sourceUrl (normalized), secondarily by title+sourceName.
    const seenUrls = new Set<string>()
    const seenTitles = new Set<string>()
    const out: RawTriggerEvent[] = []

    for (const e of merged) {
      const url = safeUrl(e.sourceUrl)
      if (!url) continue
      const urlKey = url.toLowerCase()
      if (seenUrls.has(urlKey)) continue

      const titleKey = `${(e.title || e.headline || '').trim().toLowerCase()}::${(e.sourceName || '').trim().toLowerCase()}`
      if (titleKey !== '::' && seenTitles.has(titleKey)) continue

      seenUrls.add(urlKey)
      if (titleKey !== '::') seenTitles.add(titleKey)
      out.push({ ...e, sourceUrl: url })
    }

    return out
  }
}

function providerNoop(): TriggerEventsProvider {
  return async () => []
}

function buildQuery(input: ProviderInput): string {
  const parts: string[] = []
  if (input.companyDomain) parts.push(`"${input.companyDomain}"`)
  if (input.companyName) parts.push(`"${input.companyName}"`)
  return parts.join(' OR ')
}

type ProviderSpec = {
  name: TriggerEventsProviderName
  enabled: boolean
  skipReason?: string
  shouldRun?: (input: ProviderInput) => { ok: boolean; reason?: string }
  run: TriggerEventsProvider
}

function getProviderSpec(name: TriggerEventsProviderName): ProviderSpec {
  if (name === 'none') return { name, enabled: false, skipReason: 'disabled', run: providerNoop() }
  if (name === 'custom')
    return {
      name,
      enabled: true,
      run: async () => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[trigger-events] provider=custom is not configured; returning 0 events')
        }
        return []
      },
    }
  if (name === 'newsapi') return makeNewsApiSpec()
  if (name === 'finnhub') return makeFinnhubSpec()
  if (name === 'gdelt') return makeGdeltSpec()
  if (name === 'crunchbase') return makeCrunchbaseSpec()
  if (name === 'rss') return makeRssSpec()
  return { name: 'none', enabled: false, skipReason: 'unknown', run: providerNoop() }
}

export function getProviderByName(name: TriggerEventsProviderName): TriggerEventsProvider {
  return getProviderSpec(name).run
}

export function getCompositeTriggerEventsProvider(args?: {
  ctx?: ProviderLogContext
  overrideSpecs?: ProviderSpec[]
}): TriggerEventsProvider {
  const ctx = args?.ctx ?? {}
  const specs = args?.overrideSpecs ?? getConfiguredProviderNames().map(getProviderSpec)

  return async (input: ProviderInput) => {
    const providerCounts: Record<string, number> = {}
    const merged: RawTriggerEvent[] = []

    for (const spec of specs) {
      const providerName = spec.name
      providerCounts[providerName] = 0

      if (!spec.enabled) {
        logTriggerProvider('debug', 'provider.skipped', { providerName, reason: spec.skipReason ?? 'disabled', ...ctx })
        continue
      }
      const gate = spec.shouldRun?.(input) ?? { ok: true }
      if (!gate.ok) {
        logTriggerProvider('debug', 'provider.skipped', { providerName, reason: gate.reason ?? 'low_specificity', ...ctx })
        continue
      }

      const results = await withProviderLogging(providerName, () => spec.run(input), ctx)
      providerCounts[providerName] = results.length
      merged.push(...results)
    }

    const deduped = composeProviders([async () => merged])(input)
    const out = await deduped
    logTriggerProvider('info', 'composite.summary', { totalEvents: out.length, providerCounts, ...ctx })
    return out
  }
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function makeNewsApiSpec(): ProviderSpec {
  const apiKey = (process.env.NEWSAPI_API_KEY ?? '').trim()
  if (!apiKey) return { name: 'newsapi', enabled: false, skipReason: 'missing_api_key', run: providerNoop() }
  const max = getMaxPerProvider()

  function shouldRun(input: ProviderInput) {
    const name = (input.companyName ?? '').trim()
    const domain = (input.companyDomain ?? '').trim()
    if (name.length >= 2 || domain.length >= 2) return { ok: true as const }
    return { ok: false as const, reason: 'low_specificity' }
  }

  const run: TriggerEventsProvider = async (input) => {
    const q = buildQuery(input)
    if (!q) return []

    try {
      const url = new URL('https://newsapi.org/v2/everything')
      // Prefer company-centric queries in title/description with B2B keywords.
      const b2b =
        '(funding OR acquisition OR partnership OR contract OR "product launch" OR launches OR hires OR expansion OR "new office" OR appoints OR integrates OR compliance OR security)'
      url.searchParams.set('q', `(${q}) AND ${b2b}`)
      // Bias toward company-centric titles when a company name exists.
      if (input.companyName) {
        url.searchParams.set('qInTitle', input.companyName)
      }
      url.searchParams.set('searchIn', 'title,description')
      url.searchParams.set('language', 'en')
      url.searchParams.set('sortBy', 'publishedAt')
      url.searchParams.set('from', hoursAgoIso(72))
      url.searchParams.set('pageSize', String(max))
      url.searchParams.set('apiKey', apiKey)

      const res = await fetch(url.toString(), { method: 'GET' })
      if (!res.ok) return []
      const json = (await res.json()) as unknown
      const articles = (json as { articles?: unknown }).articles
      if (!Array.isArray(articles)) return []

      const out: RawTriggerEvent[] = []
      for (const a of articles) {
        const row = a as {
          title?: unknown
          description?: unknown
          url?: unknown
          publishedAt?: unknown
          source?: { name?: unknown } | null
        }
        const title = typeof row.title === 'string' ? row.title.trim() : ''
        const sourceUrl = typeof row.url === 'string' ? row.url : ''
        const urlOk = safeUrl(sourceUrl)
        if (!title || !urlOk) continue
        const publishedAt = typeof row.publishedAt === 'string' ? row.publishedAt : null
        const occurredAt = publishedAt ? new Date(publishedAt) : null
        const sourceName = typeof row.source?.name === 'string' ? row.source?.name : null
        const description = typeof row.description === 'string' ? row.description : null
        out.push({
          title,
          headline: title,
          description,
          sourceName,
          sourceUrl: urlOk,
          companyName: input.companyName ?? null,
          companyDomain: input.companyDomain ?? null,
          occurredAt: occurredAt && Number.isFinite(occurredAt.getTime()) ? occurredAt : null,
        })
        if (out.length >= max) break
      }
      return out
    } catch (err) {
      console.warn('[trigger-events] newsapi provider failed', { message: err instanceof Error ? err.message : 'unknown' })
      return []
    }
  }

  return { name: 'newsapi', enabled: true, shouldRun, run }
}

function makeFinnhubSpec(): ProviderSpec {
  const apiKey = (process.env.FINNHUB_API_KEY ?? process.env.MARKET_DATA_API_KEY ?? '').trim()
  if (!apiKey) return { name: 'finnhub', enabled: false, skipReason: 'missing_api_key', run: providerNoop() }
  const max = getMaxPerProvider()

  function shouldRun(input: ProviderInput) {
    const name = (input.companyName ?? '').trim()
    const domain = (input.companyDomain ?? '').trim()
    if (name.length >= 2 || domain.length >= 2) return { ok: true as const }
    return { ok: false as const, reason: 'low_specificity' }
  }

  async function lookupSymbol(q: string): Promise<string | null> {
    try {
      const url = new URL('https://finnhub.io/api/v1/search')
      url.searchParams.set('q', q)
      url.searchParams.set('token', apiKey)
      const res = await fetch(url.toString(), { method: 'GET' })
      if (!res.ok) return null
      const json = (await res.json()) as unknown
      const results = (json as { result?: unknown }).result
      if (!Array.isArray(results)) return null
      const first = results.find((r: any) => typeof r?.symbol === 'string' && (r?.type === 'Common Stock' || r?.type === 'ADR')) ?? results[0]
      const sym = typeof (first as any)?.symbol === 'string' ? ((first as any).symbol as string) : null
      return sym ? sym.trim().toUpperCase() : null
    } catch {
      return null
    }
  }

  const run: TriggerEventsProvider = async (input) => {
    try {
      const name = (input.companyName ?? '').trim()
      const domain = (input.companyDomain ?? '').trim()
      const q = name || (domain ? domain.split('.')[0] : '')
      if (!q) return []

      const symbol = (await lookupSymbol(q)) ?? (name && /^[A-Z]{1,6}$/.test(name) ? name : null)
      if (!symbol) return []

      const to = new Date()
      const from = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      const fmt = (d: Date) => d.toISOString().slice(0, 10)
      const url = new URL('https://finnhub.io/api/v1/company-news')
      url.searchParams.set('symbol', symbol)
      url.searchParams.set('from', fmt(from))
      url.searchParams.set('to', fmt(to))
      url.searchParams.set('token', apiKey)

      const res = await fetch(url.toString(), { method: 'GET' })
      if (!res.ok) return []
      const json = (await res.json()) as unknown
      if (!Array.isArray(json)) return []

      const out: RawTriggerEvent[] = []
      for (const item of json) {
        const row = item as { headline?: unknown; summary?: unknown; url?: unknown; source?: unknown; datetime?: unknown }
        const title = typeof row.headline === 'string' ? row.headline.trim() : ''
        const urlOk = typeof row.url === 'string' ? safeUrl(row.url) : null
        if (!title || !urlOk) continue
        const occurredAt =
          typeof row.datetime === 'number' && Number.isFinite(row.datetime) ? new Date(row.datetime * 1000) : null
        out.push({
          title,
          headline: title,
          description: typeof row.summary === 'string' ? row.summary : null,
          sourceName: typeof row.source === 'string' ? row.source : null,
          sourceUrl: urlOk,
          companyName: input.companyName ?? null,
          companyDomain: input.companyDomain ?? null,
          occurredAt,
        })
        if (out.length >= max) break
      }
      return out
    } catch (err) {
      console.warn('[trigger-events] finnhub provider failed', { message: err instanceof Error ? err.message : 'unknown' })
      return []
    }
  }

  return { name: 'finnhub', enabled: true, shouldRun, run }
}

function formatGdeltDatetime(d: Date): string {
  const yyyy = String(d.getUTCFullYear()).padStart(4, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`
}

function makeGdeltSpec(): ProviderSpec {
  const baseUrl = (process.env.GDELT_BASE_URL ?? 'https://api.gdeltproject.org/api/v2/doc/doc').trim()
  const baseOk = safeUrl(baseUrl)
  if (!baseOk) return { name: 'gdelt', enabled: false, skipReason: 'invalid_base_url', run: providerNoop() }
  const max = getMaxPerProvider()

  function shouldRun(input: ProviderInput) {
    const q = buildQuery(input)
    if (q) return { ok: true as const }
    return { ok: false as const, reason: 'low_specificity' }
  }

  const run: TriggerEventsProvider = async (input) => {
    const q = buildQuery(input)
    if (!q) return []

    try {
      const url = new URL(baseOk)
      // Keep query specific and recent; bias toward English content.
      url.searchParams.set('query', `(${q}) sourcelang:english`)
      url.searchParams.set('mode', 'ArtList')
      url.searchParams.set('format', 'json')
      url.searchParams.set('sort', 'datedesc')
      url.searchParams.set('maxrecords', String(max))
      const end = new Date()
      const start = new Date(Date.now() - 72 * 60 * 60 * 1000)
      url.searchParams.set('startdatetime', formatGdeltDatetime(start))
      url.searchParams.set('enddatetime', formatGdeltDatetime(end))
      if (input.companyDomain) {
        url.searchParams.set('domain', input.companyDomain)
      }

      const res = await fetch(url.toString(), { method: 'GET' })
      if (!res.ok) return []
      const json = (await res.json()) as unknown
      const articles = (json as { articles?: unknown }).articles
      if (!Array.isArray(articles)) return []

      const out: RawTriggerEvent[] = []
      for (const a of articles) {
        const row = a as { title?: unknown; url?: unknown; seendate?: unknown; sourceCountry?: unknown; source?: unknown }
        const title = typeof row.title === 'string' ? row.title.trim() : ''
        const urlOk = typeof row.url === 'string' ? safeUrl(row.url) : null
        if (!title || !urlOk) continue
        const seendate = typeof row.seendate === 'string' ? row.seendate : null
        const occurredAt = seendate ? new Date(seendate) : null
        out.push({
          title,
          headline: title,
          description: null,
          sourceName: typeof row.source === 'string' ? row.source : typeof row.sourceCountry === 'string' ? row.sourceCountry : null,
          sourceUrl: urlOk,
          companyName: input.companyName ?? null,
          companyDomain: input.companyDomain ?? null,
          occurredAt: occurredAt && Number.isFinite(occurredAt.getTime()) ? occurredAt : null,
        })
        if (out.length >= max) break
      }

      return out
    } catch (err) {
      console.warn('[trigger-events] gdelt provider failed', { message: err instanceof Error ? err.message : 'unknown' })
      return []
    }
  }

  return { name: 'gdelt', enabled: true, shouldRun, run }
}

function makeCrunchbaseSpec(): ProviderSpec {
  const apiKey = (process.env.CRUNCHBASE_API_KEY ?? '').trim()
  if (!apiKey) return { name: 'crunchbase', enabled: false, skipReason: 'missing_api_key', run: providerNoop() }
  // TODO: implement Crunchbase integration. Keep noop for now (minimal, safe).
  return { name: 'crunchbase', enabled: true, run: async () => [] }
}

function makeRssSpec(): ProviderSpec {
  const feedsRaw = (process.env.TRIGGER_EVENTS_RSS_FEEDS ?? '').trim()
  if (!feedsRaw) return { name: 'rss', enabled: false, skipReason: 'missing_feeds', run: providerNoop() }
  const max = getMaxPerProvider()
  const feeds = feedsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((u) => safeUrl(u))
    .filter((u): u is string => Boolean(u))

  if (feeds.length === 0) return { name: 'rss', enabled: false, skipReason: 'no_valid_feeds', run: providerNoop() }

  const parser = new Parser()

  function matches(text: string, input: ProviderInput): boolean {
    const t = text.toLowerCase()
    const name = (input.companyName ?? '').toLowerCase()
    const domain = (input.companyDomain ?? '').toLowerCase()
    return (name.length > 0 && t.includes(name)) || (domain.length > 0 && t.includes(domain))
  }

  function linkHostMatches(link: string, domain: string): boolean {
    try {
      const u = new URL(link)
      const host = u.hostname.toLowerCase()
      const d = domain.toLowerCase()
      return host === d || host.endsWith(`.${d}`)
    } catch {
      return false
    }
  }

  function shouldRun(input: ProviderInput) {
    const name = (input.companyName ?? '').trim()
    const domain = (input.companyDomain ?? '').trim()
    if (name.length >= 2 || domain.length >= 2) return { ok: true as const }
    return { ok: false as const, reason: 'low_specificity' }
  }

  const run: TriggerEventsProvider = async (input) => {
    if (!input.companyName && !input.companyDomain) return []
    const out: RawTriggerEvent[] = []

    for (const feedUrl of feeds) {
      if (out.length >= max) break
      try {
        const res = await fetch(feedUrl, { method: 'GET' })
        if (!res.ok) continue
        const xml = await res.text()
        const feed = await parser.parseString(xml)
        const total = (feed.items ?? []).length
        let matched = 0
        for (const item of feed.items ?? []) {
          const title = (item.title ?? '').trim()
          const link = (item.link ?? '').trim()
          const urlOk = safeUrl(link)
          if (!title || !urlOk) continue
          const blob = `${title} ${(item.contentSnippet ?? '')} ${(item.content ?? '')}`
          const domain = input.companyDomain ?? ''
          const pass =
            matches(blob, input) ||
            (domain ? linkHostMatches(urlOk, domain) : false)
          if (!pass) continue
          matched++
          const occurredAt = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null
          out.push({
            title,
            headline: title,
            description: typeof item.contentSnippet === 'string' ? item.contentSnippet : null,
            sourceName: feed.title ?? null,
            sourceUrl: urlOk,
            companyName: input.companyName ?? null,
            companyDomain: input.companyDomain ?? null,
            occurredAt: occurredAt && Number.isFinite(occurredAt.getTime()) ? occurredAt : null,
          })
          if (out.length >= max) break
        }
        logTriggerProvider('debug', 'rss.feed.summary', { feedUrl, totalItems: total, matchedItems: matched })
      } catch (err) {
        console.warn('[trigger-events] rss provider failed', { feedUrl, message: err instanceof Error ? err.message : 'unknown' })
        continue
      }
    }

    return out.slice(0, max)
  }

  return { name: 'rss', enabled: true, shouldRun, run }
}

