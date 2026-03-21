import Parser from 'rss-parser'
import { classifySignal, type ClassifiedSignal } from '@/lib/prospect-watch/classify'

export type RssItemSignal = {
  sourceUrl: string
  sourceName: string | null
  title: string
  snippet: string | null
  occurredAt: Date | null
  classified: ClassifiedSignal
}

function safeUrl(u: string): string | null {
  try {
    const url = new URL(u)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

async function fetchTextWithTimeout(url: string, timeoutMs: number): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      headers: { 'user-agent': 'LeadIntelProspectWatch/1.0' },
      signal: controller.signal,
    })
    const text = await res.text()
    return { ok: res.ok, status: res.status, text }
  } catch {
    return { ok: false, status: 0, text: '' }
  } finally {
    clearTimeout(t)
  }
}

function matchesTarget(text: string, target: { companyName: string; companyDomain: string | null }): boolean {
  const t = text.toLowerCase()
  const name = target.companyName.toLowerCase()
  const domain = (target.companyDomain ?? '').toLowerCase()
  if (name.length >= 3 && t.includes(name)) return true
  if (domain.length >= 3 && t.includes(domain)) return true
  return false
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

export async function ingestRssSignals(args: {
  feedUrls: string[]
  target: { companyName: string; companyDomain: string | null }
  maxItems: number
}): Promise<{ signals: RssItemSignal[]; scanned: number; matched: number }> {
  const parser = new Parser()
  const out: RssItemSignal[] = []
  let scanned = 0
  let matched = 0

  for (const raw of args.feedUrls) {
    if (out.length >= args.maxItems) break
    const feedUrl = safeUrl(raw)
    if (!feedUrl) continue

    const res = await fetchTextWithTimeout(feedUrl, 10_000)
    if (!res.ok) continue

    let feed: Parser.Output<any>
    try {
      feed = await parser.parseString(res.text)
    } catch {
      continue
    }

    const sourceName = typeof feed.title === 'string' ? feed.title : null
    for (const item of feed.items ?? []) {
      if (out.length >= args.maxItems) break
      scanned += 1
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const link = typeof item.link === 'string' ? item.link.trim() : ''
      const urlOk = safeUrl(link)
      if (!title || !urlOk) continue
      const snippet =
        typeof (item as any).contentSnippet === 'string'
          ? ((item as any).contentSnippet as string)
          : typeof (item as any).content === 'string'
            ? ((item as any).content as string)
            : null
      const blob = `${title} ${snippet ?? ''} ${urlOk}`
      const domain = args.target.companyDomain
      const pass = matchesTarget(blob, args.target) || (domain ? linkHostMatches(urlOk, domain) : false)
      if (!pass) continue

      matched += 1
      const occurredAt =
        typeof (item as any).isoDate === 'string'
          ? new Date((item as any).isoDate)
          : typeof (item as any).pubDate === 'string'
            ? new Date((item as any).pubDate)
            : null
      const occurred = occurredAt && Number.isFinite(occurredAt.getTime()) ? occurredAt : null
      const classified = classifySignal({ title, snippet, url: urlOk })
      out.push({ sourceUrl: urlOk, sourceName, title, snippet, occurredAt: occurred, classified })
    }
  }

  return { signals: out, scanned, matched }
}

