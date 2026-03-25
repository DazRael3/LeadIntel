import Parser from 'rss-parser'
import { classifySignal, type ClassifiedSignal } from '@/lib/prospect-watch/classify'
import { bumpReject, createIngestStats, type ProspectWatchIngestStats } from '@/lib/prospect-watch/ingest-stats'

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
}): Promise<{ signals: RssItemSignal[]; scanned: number; matched: number; stats: ProspectWatchIngestStats }> {
  const parser = new Parser()
  const out: RssItemSignal[] = []
  let scanned = 0
  let matched = 0
  const stats = createIngestStats({ feedsAttempted: args.feedUrls.length })

  for (const raw of args.feedUrls) {
    if (out.length >= args.maxItems) break
    const feedUrl = safeUrl(raw)
    if (!feedUrl) continue

    const res = await fetchTextWithTimeout(feedUrl, 10_000)
    if (!res.ok) {
      bumpReject(stats, 'feed_fetch_failed')
      continue
    }
    stats.feedsFetchedOk += 1

    let feed: Parser.Output<any>
    try {
      feed = await parser.parseString(res.text)
    } catch {
      bumpReject(stats, 'feed_parse_failed')
      continue
    }
    stats.feedsParsedOk += 1

    const sourceName = typeof feed.title === 'string' ? feed.title : null
    for (const item of feed.items ?? []) {
      if (out.length >= args.maxItems) break
      scanned += 1
      stats.itemsScanned += 1
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const link = typeof item.link === 'string' ? item.link.trim() : ''
      if (!title) {
        bumpReject(stats, 'item_missing_title')
        continue
      }
      if (!link) {
        bumpReject(stats, 'item_missing_link')
        continue
      }
      const urlOk = safeUrl(link)
      if (!urlOk) {
        bumpReject(stats, 'item_invalid_link')
        continue
      }
      const snippet =
        typeof (item as any).contentSnippet === 'string'
          ? ((item as any).contentSnippet as string)
          : typeof (item as any).content === 'string'
            ? ((item as any).content as string)
            : null
      const blob = `${title} ${snippet ?? ''} ${urlOk}`
      const domain = args.target.companyDomain
      const pass = matchesTarget(blob, args.target) || (domain ? linkHostMatches(urlOk, domain) : false)
      if (!pass) {
        bumpReject(stats, 'target_no_match')
        continue
      }

      matched += 1
      stats.itemsMatched += 1
      const occurredAt =
        typeof (item as any).isoDate === 'string'
          ? new Date((item as any).isoDate)
          : typeof (item as any).pubDate === 'string'
            ? new Date((item as any).pubDate)
            : null
      const occurred = occurredAt && Number.isFinite(occurredAt.getTime()) ? occurredAt : null
      const classified = classifySignal({ title, snippet, url: urlOk })
      stats.signalsProposed += 1
      out.push({ sourceUrl: urlOk, sourceName, title, snippet, occurredAt: occurred, classified })
    }
  }

  return { signals: out, scanned, matched, stats }
}

