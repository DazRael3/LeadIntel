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

export function getProviderByName(name: TriggerEventsProviderName): TriggerEventsProvider {
  if (name === 'none') return providerNoop()
  if (name === 'custom') {
    return async () => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[trigger-events] provider=custom is not configured; returning 0 events')
      }
      return []
    }
  }
  if (name === 'newsapi') return makeNewsApiProvider()
  if (name === 'finnhub') return makeFinnhubProvider()
  if (name === 'gdelt') return makeGdeltProvider()
  if (name === 'crunchbase') return makeCrunchbaseProvider()
  if (name === 'rss') return makeRssProvider()
  return providerNoop()
}

export function getCompositeTriggerEventsProvider(): TriggerEventsProvider {
  const names = getConfiguredProviderNames()
  const providers = names.map(getProviderByName)
  return composeProviders(providers)
}

function makeNewsApiProvider(): TriggerEventsProvider {
  const apiKey = (process.env.NEWSAPI_API_KEY ?? '').trim()
  if (!apiKey) return providerNoop()
  const max = getMaxPerProvider()

  return async (input) => {
    const q = buildQuery(input)
    if (!q) return []

    try {
      const url = new URL('https://newsapi.org/v2/everything')
      url.searchParams.set('q', q)
      url.searchParams.set('language', 'en')
      url.searchParams.set('sortBy', 'publishedAt')
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
}

function makeFinnhubProvider(): TriggerEventsProvider {
  const apiKey = (process.env.FINNHUB_API_KEY ?? process.env.MARKET_DATA_API_KEY ?? '').trim()
  if (!apiKey) return providerNoop()
  const max = getMaxPerProvider()

  function deriveSymbol(input: ProviderInput): string | null {
    const name = (input.companyName ?? '').trim()
    if (/^[A-Z]{1,6}$/.test(name)) return name
    const domain = (input.companyDomain ?? '').trim().toLowerCase()
    if (!domain) return null
    const base = domain.split('.')[0] || ''
    const sym = base.replace(/[^a-z0-9]/gi, '').toUpperCase()
    return sym ? sym.slice(0, 6) : null
  }

  return async (input) => {
    const symbol = deriveSymbol(input)
    if (!symbol) return []

    try {
      const to = new Date()
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
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
}

function makeGdeltProvider(): TriggerEventsProvider {
  const baseUrl = (process.env.GDELT_BASE_URL ?? 'https://api.gdeltproject.org/api/v2/doc/doc').trim()
  const baseOk = safeUrl(baseUrl)
  if (!baseOk) return providerNoop()
  const max = getMaxPerProvider()

  return async (input) => {
    const q = buildQuery(input)
    if (!q) return []

    try {
      const url = new URL(baseOk)
      url.searchParams.set('query', q)
      url.searchParams.set('mode', 'ArtList')
      url.searchParams.set('format', 'json')
      url.searchParams.set('sort', 'datedesc')
      url.searchParams.set('maxrecords', String(max))

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
}

function makeCrunchbaseProvider(): TriggerEventsProvider {
  const apiKey = (process.env.CRUNCHBASE_API_KEY ?? '').trim()
  if (!apiKey) return providerNoop()
  // TODO: implement Crunchbase integration. Keep noop for now (minimal, safe).
  return async () => []
}

function makeRssProvider(): TriggerEventsProvider {
  const feedsRaw = (process.env.TRIGGER_EVENTS_RSS_FEEDS ?? '').trim()
  if (!feedsRaw) return providerNoop()
  const max = getMaxPerProvider()
  const feeds = feedsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((u) => safeUrl(u))
    .filter((u): u is string => Boolean(u))

  if (feeds.length === 0) return providerNoop()

  const parser = new Parser()

  function matches(text: string, input: ProviderInput): boolean {
    const t = text.toLowerCase()
    const name = (input.companyName ?? '').toLowerCase()
    const domain = (input.companyDomain ?? '').toLowerCase()
    return (name.length > 0 && t.includes(name)) || (domain.length > 0 && t.includes(domain))
  }

  return async (input) => {
    if (!input.companyName && !input.companyDomain) return []
    const out: RawTriggerEvent[] = []

    for (const feedUrl of feeds) {
      if (out.length >= max) break
      try {
        const res = await fetch(feedUrl, { method: 'GET' })
        if (!res.ok) continue
        const xml = await res.text()
        const feed = await parser.parseString(xml)
        for (const item of feed.items ?? []) {
          const title = (item.title ?? '').trim()
          const link = (item.link ?? '').trim()
          const urlOk = safeUrl(link)
          if (!title || !urlOk) continue
          const blob = `${title} ${(item.contentSnippet ?? '')} ${(item.content ?? '')}`
          if (!matches(blob, input)) continue
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
      } catch (err) {
        console.warn('[trigger-events] rss provider failed', { feedUrl, message: err instanceof Error ? err.message : 'unknown' })
        continue
      }
    }

    return out.slice(0, max)
  }
}

