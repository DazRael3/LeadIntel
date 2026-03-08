export type SourceType = 'gdelt' | 'first_party' | 'greenhouse' | 'lever' | 'sec'

export type NormalizedCitation = {
  url: string
  title?: string
  publishedAt?: string
  source?: string
  type?: string
}

function safeTrim(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function slugifyName(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s.slice(0, 80) || 'unknown'
}

export function normalizeCompanyDomain(raw: string): string | null {
  const v = safeTrim(raw)
  if (!v) return null
  try {
    const url = v.startsWith('http') ? new URL(v) : new URL(`https://${v}`)
    const host = url.hostname.replace(/^www\./i, '').toLowerCase()
    return host.includes('.') ? host : null
  } catch {
    const cleaned = v.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]?.toLowerCase() ?? ''
    return cleaned.includes('.') ? cleaned : null
  }
}

export function normalizeInputUrl(raw: string): string | null {
  const v = safeTrim(raw)
  if (!v) return null
  try {
    const u = new URL(v.startsWith('http') ? v : `https://${v}`)
    // Keep origin + pathname only to reduce cache key variability
    const out = `${u.origin}${u.pathname}`.replace(/\/+$/g, '')
    return out
  } catch {
    return null
  }
}

export function normalizeCompanyKey(args: {
  companyName: string
  companyDomain?: string | null
  inputUrl?: string | null
}): { companyKey: string; companyDomain: string | null; inputUrl: string | null; companyName: string } {
  const companyName = safeTrim(args.companyName).slice(0, 120) || 'Unknown'
  const domain = args.companyDomain ? normalizeCompanyDomain(args.companyDomain) : null
  const inputUrl = args.inputUrl ? normalizeInputUrl(args.inputUrl) : null

  if (domain) {
    return { companyKey: domain, companyDomain: domain, inputUrl, companyName }
  }
  return { companyKey: slugifyName(companyName), companyDomain: null, inputUrl, companyName }
}

export function normalizeCitations(raw: NormalizedCitation[]): NormalizedCitation[] {
  const seen = new Set<string>()
  const out: NormalizedCitation[] = []
  for (const c of raw) {
    const url = safeTrim(c.url)
    if (!url) continue
    let normalizedUrl = url
    try {
      const u = new URL(url)
      normalizedUrl = u.toString()
    } catch {
      continue
    }
    const key = normalizedUrl.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      url: normalizedUrl,
      title: safeTrim(c.title) || undefined,
      publishedAt: safeTrim(c.publishedAt) || undefined,
      source: safeTrim(c.source) || undefined,
      type: safeTrim(c.type) || undefined,
    })
    if (out.length >= 100) break
  }
  return out
}

