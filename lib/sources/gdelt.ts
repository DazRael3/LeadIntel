import { fetchJson } from '@/lib/sources/http'
import type { NormalizedCitation } from '@/lib/sources/normalize'
import { normalizeCitations } from '@/lib/sources/normalize'

type GdeltArticle = {
  url?: string
  title?: string
  seendate?: string
  sourceCountry?: string
  domain?: string
  language?: string
}

type GdeltResponse = {
  articles?: GdeltArticle[]
  timeline?: Array<{ date: string; value: number }>
}

function yyyymmddhhmmss(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(
    d.getUTCSeconds()
  )}`
}

function buildQuery(args: { companyName: string; companyDomain: string | null }): string {
  const name = args.companyName.trim()
  const domain = args.companyDomain?.trim()
  // Favor domain when present for precision; fall back to quoted name.
  if (domain) return `domain:${domain}`
  // Quote and limit to reduce noise.
  return `"${name.replace(/"/g, '')}"`
}

export async function fetchGdeltNews(args: {
  companyName: string
  companyDomain: string | null
}): Promise<
  | {
      ok: true
      payload: { query: string; articlesCount: number; articles: Array<{ url: string; title: string; publishedAt: string | null; source?: string }> }
      citations: NormalizedCitation[]
      meta: Record<string, unknown>
    }
  | { ok: false; payload: {}; citations: []; meta: Record<string, unknown> }
> {
  const query = buildQuery(args)
  const base = 'https://api.gdeltproject.org/api/v2/doc/doc'
  const end = new Date()
  const start = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)

  const url =
    `${base}?` +
    new URLSearchParams({
      query,
      mode: 'ArtList',
      format: 'json',
      maxrecords: '15',
      sort: 'HybridRel',
      startdatetime: yyyymmddhhmmss(start),
      enddatetime: yyyymmddhhmmss(end),
    }).toString()

  const res = await fetchJson<GdeltResponse>({ url, timeoutMs: 6500 })
  if (!res.ok) {
    return { ok: false, payload: {}, citations: [], meta: { errorCode: res.errorCode, status: res.status, url: res.url } }
  }

  const articles = (res.json.articles ?? [])
    .map((a) => {
      const url = typeof a.url === 'string' ? a.url.trim() : ''
      const title = typeof a.title === 'string' ? a.title.trim() : ''
      if (!url || !title) return null
      const publishedAt = typeof a.seendate === 'string' ? a.seendate.trim() : null
      return { url, title, publishedAt, source: typeof a.domain === 'string' ? a.domain.trim() : undefined }
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))

  const citations = normalizeCitations(
    articles.map((a) => ({
      url: a.url,
      title: a.title,
      publishedAt: a.publishedAt ?? undefined,
      source: a.source ?? 'GDELT',
      type: 'news',
    }))
  )

  return {
    ok: true,
    payload: {
      query,
      articlesCount: articles.length,
      articles,
    },
    citations,
    meta: { status: res.status, url: res.url },
  }
}

