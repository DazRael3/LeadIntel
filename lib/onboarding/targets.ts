export type ParsedTarget = {
  raw: string
  /** Normalized domain (no scheme, no www) when available. */
  domain: string | null
  /** Normalized https URL when a domain is available. */
  url: string | null
  /** Display name (user-provided when not a domain/URL). */
  name: string
}

function stripInvisibleAndTrim(input: string): string {
  // Mobile keyboards and copy/paste can inject invisible characters that break naive validation.
  // Keep this conservative: remove common zero-width / BOM / directionality marks.
  return input
    .replace(/[\u200B-\u200F\uFEFF]/g, '')
    .trim()
}

function normalizeCompanyToken(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48)
}

function normalizeHostname(hostname: string): string | null {
  const h = stripInvisibleAndTrim(hostname).toLowerCase().replace(/^www\./, '')
  if (!h) return null
  // Very light validation: keep it conservative.
  if (!h.includes('.')) return null
  if (h.includes(' ')) return null
  // Guard against accidental path/query fragments in hostname-like strings.
  if (h.includes('/') || h.includes('?') || h.includes('#')) return null
  return h
}

export function parseTarget(input: string): ParsedTarget | null {
  const raw = stripInvisibleAndTrim(input).replace(/[,\s]+$/g, '')
  if (!raw) return null

  // URL
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const u = new URL(raw)
      const domain = normalizeHostname(u.hostname)
      if (!domain) return null
      return { raw, domain, url: `https://${domain}`, name: domain }
    }
  } catch {
    // fall through
  }

  // Domain
  const looksLikeDomain = raw.includes('.') && !raw.includes(' ')
  if (looksLikeDomain) {
    // Common paste forms: "example.com/", "www.example.com/path?x=1"
    const trimmed = raw.replace(/[)\].]+$/g, '') // light trailing punctuation cleanup
    const direct = normalizeHostname(trimmed)
    if (direct) {
      return { raw, domain: direct, url: `https://${direct}`, name: direct }
    }
    try {
      const u = new URL(`https://${trimmed}`)
      const domain = normalizeHostname(u.hostname)
      if (!domain) return null
      return { raw, domain, url: `https://${domain}`, name: domain }
    } catch {
      return null
    }
  }

  // Company name (no guessing beyond a stable token; domain remains null)
  const token = normalizeCompanyToken(raw)
  if (!token) return null
  return { raw, domain: null, url: null, name: raw }
}

export function parseTargetsFromText(input: string, maxTargets: number): ParsedTarget[] {
  const tokens = input
    .split('\n')
    .flatMap((line) => line.split(','))
    .map((l) => l.trim())
    .filter(Boolean)

  const unique: string[] = []
  const seen = new Set<string>()
  for (const t of tokens) {
    const key = t.trim().toLowerCase()
    if (!key) continue
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(t)
    if (unique.length >= maxTargets) break
  }

  return unique.map((t) => parseTarget(t)).filter((x): x is ParsedTarget => x !== null)
}

