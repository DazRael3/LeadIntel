import { fetchText } from '@/lib/sources/http'
import type { NormalizedCitation } from '@/lib/sources/normalize'
import { normalizeCitations, normalizeCompanyDomain, normalizeInputUrl } from '@/lib/sources/normalize'

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)
  return m ? m[1].trim() : null
}

function extractMetaDescription(html: string): string | null {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,300})["'][^>]*>/i)
  return m ? m[1].trim() : null
}

function extractInternalLinks(html: string, origin: string): Array<{ url: string; text: string }> {
  const links: Array<{ url: string; text: string }> = []
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi
  let match: RegExpExecArray | null = null
  while ((match = re.exec(html)) !== null) {
    const href = match[1]?.trim() ?? ''
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue
    let url: string | null = null
    try {
      const u = new URL(href, origin)
      if (u.origin !== origin) continue
      url = `${u.origin}${u.pathname}`.replace(/\/+$/g, '')
    } catch {
      url = null
    }
    if (!url) continue
    const text = (match[2] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (text.length < 3) continue
    links.push({ url, text: text.slice(0, 140) })
    if (links.length >= 100) break
  }
  return links
}

function scoreAnnouncementLink(pathname: string, text: string): number {
  const p = pathname.toLowerCase()
  const t = text.toLowerCase()
  let score = 0
  if (p.includes('press') || p.includes('news') || p.includes('blog') || p.includes('changelog')) score += 2
  if (p.includes('release') || p.includes('launch') || p.includes('announce') || p.includes('updates')) score += 2
  if (t.includes('announ') || t.includes('launch') || t.includes('release') || t.includes('new')) score += 1
  if (t.includes('security') || t.includes('trust') || t.includes('compliance')) score += 1
  return score
}

export async function fetchFirstPartySignals(args: {
  companyDomain: string | null
  inputUrl: string | null
}): Promise<
  | {
      ok: true
      payload: {
        fetched: Array<{ url: string; status: number; title: string | null; description: string | null }>
        topLinks: Array<{ url: string; text: string; score: number }>
      }
      citations: NormalizedCitation[]
      meta: Record<string, unknown>
    }
  | { ok: false; payload: {}; citations: []; meta: Record<string, unknown> }
> {
  const domain = args.companyDomain ? normalizeCompanyDomain(args.companyDomain) : null
  const inputUrl = args.inputUrl ? normalizeInputUrl(args.inputUrl) : null
  const base = inputUrl ? (() => {
    try {
      const u = new URL(inputUrl)
      return u.origin
    } catch {
      return null
    }
  })() : domain ? `https://${domain}` : null

  if (!base) {
    return { ok: false, payload: {}, citations: [], meta: { errorCode: 'missing_base_url' } }
  }

  const paths = ['/', '/press', '/news', '/blog', '/changelog', '/security', '/careers', '/jobs']
  const fetched: Array<{ url: string; status: number; title: string | null; description: string | null; html: string }> = []

  for (const p of paths) {
    const url = `${base}${p}`.replace(/\/+$/g, p === '/' ? '/' : '')
    const res = await fetchText({ url, timeoutMs: 6500, headers: { accept: 'text/html' } })
    if (!res.ok) {
      continue
    }
    fetched.push({
      url: res.url,
      status: res.status,
      title: extractTitle(res.text),
      description: extractMetaDescription(res.text),
      html: res.text,
    })
    if (fetched.length >= 6) break
  }

  if (fetched.length === 0) {
    return { ok: false, payload: {}, citations: [], meta: { errorCode: 'first_party_unreachable', base } }
  }

  const origin = (() => {
    try {
      return new URL(fetched[0].url).origin
    } catch {
      return base
    }
  })()

  const allLinks = fetched.flatMap((f) => extractInternalLinks(f.html, origin))
  const scored = new Map<string, { url: string; text: string; score: number }>()
  for (const l of allLinks) {
    let pathname = ''
    try {
      pathname = new URL(l.url).pathname
    } catch {
      pathname = ''
    }
    const score = scoreAnnouncementLink(pathname, l.text)
    if (score <= 0) continue
    const existing = scored.get(l.url)
    if (!existing || existing.score < score) scored.set(l.url, { url: l.url, text: l.text, score })
  }

  const topLinks = Array.from(scored.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)

  const citations = normalizeCitations([
    ...fetched.map((f) => ({
      url: f.url,
      title: f.title ?? undefined,
      source: domain ?? origin,
      type: 'first_party',
    })),
    ...topLinks.map((l) => ({
      url: l.url,
      title: l.text,
      source: domain ?? origin,
      type: 'first_party_link',
    })),
  ])

  return {
    ok: true,
    payload: {
      fetched: fetched.map((f) => ({ url: f.url, status: f.status, title: f.title, description: f.description })),
      topLinks,
    },
    citations,
    meta: { base: origin, fetchedCount: fetched.length, linksCount: allLinks.length },
  }
}

