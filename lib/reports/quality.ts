import { formatDistanceToNowStrict } from 'date-fns'

export type ReportQuality = {
  citations: number
  hypotheses: number
  lastRefreshedLabel: string | null
  score: number
  grade: 'excellent' | 'good' | 'needs_attention' | 'framework_only'
  breakdown: {
    citationsPoints: number
    freshnessPoints: number
    hypothesesPenalty: number
    maxPoints: number
    reasons: string[]
  }
}

type CitationLike = { url?: unknown }

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function uniqUrls(urls: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const u of urls) {
    const s = u.trim()
    if (!s) continue
    let normalized: string
    try {
      normalized = new URL(s).toString()
    } catch {
      continue
    }
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
    if (out.length >= 500) break
  }
  return out
}

function extractUrlsFromMarkdown(markdown: string): string[] {
  const text = markdown ?? ''
  const urls: string[] = []

  // Markdown links: [label](url)
  const linkRe = /\[[^\]]{0,120}\]\((https?:\/\/[^\s)]+)\)/gi
  let m: RegExpExecArray | null = null
  while ((m = linkRe.exec(text)) !== null) {
    urls.push(m[1])
    if (urls.length >= 500) break
  }

  // Reference lines: [1] https://...
  const refRe = /^\[\d+\]\s+(https?:\/\/\S+)/gim
  while ((m = refRe.exec(text)) !== null) {
    urls.push(m[1])
    if (urls.length >= 500) break
  }

  return uniqUrls(urls)
}

function countHypotheses(markdown: string): number {
  const text = markdown ?? ''
  const lines = text.split('\n')
  let inHypotheses = false
  let count = 0

  for (const raw of lines) {
    const line = raw.trim()
    const lower = line.toLowerCase()
    if (lower.startsWith('## ')) {
      inHypotheses = lower.includes('hypotheses')
      continue
    }
    if (!inHypotheses) continue
    if (lower.startsWith('- hypothesis:') || lower.startsWith('hypothesis:')) {
      count++
    }
  }

  if (count > 0) return count
  // Fallback: count occurrences anywhere (conservative cap).
  const matches = text.match(/(^|\n)\s*-\s*hypothesis:/gi)
  return clamp(matches?.length ?? 0, 0, 99)
}

function computeFreshnessLabel(sourcesFetchedAt: string | null): { label: string | null; hoursAgo: number | null } {
  if (!sourcesFetchedAt) return { label: null, hoursAgo: null }
  const t = new Date(sourcesFetchedAt).getTime()
  if (!Number.isFinite(t)) return { label: null, hoursAgo: null }
  const diffMs = Date.now() - t
  const hoursAgo = diffMs >= 0 ? diffMs / (1000 * 60 * 60) : 0
  const label = formatDistanceToNowStrict(new Date(t), { addSuffix: true })
  return { label, hoursAgo }
}

export function computeReportQuality(args: {
  reportMarkdown: string
  sourcesUsed: unknown | null
  sourcesFetchedAt: string | null
}): ReportQuality {
  const reasons: string[] = []

  const citationsFromSources =
    Array.isArray(args.sourcesUsed)
      ? uniqUrls(
          (args.sourcesUsed as CitationLike[])
            .map((c) => (typeof c?.url === 'string' ? c.url : ''))
            .filter(Boolean)
        )
      : []

  const citationsFromMarkdown = citationsFromSources.length > 0 ? [] : extractUrlsFromMarkdown(args.reportMarkdown)
  const citations = citationsFromSources.length > 0 ? citationsFromSources.length : citationsFromMarkdown.length

  const hypotheses = countHypotheses(args.reportMarkdown)

  const { label: lastRefreshedLabel, hoursAgo } = computeFreshnessLabel(args.sourcesFetchedAt)

  // citationsPoints (0–60), diminishing returns
  const c = citations
  const citationsPoints = Math.min(60, Math.round(20 * Math.log2(1 + c)))
  if (citations === 0) reasons.push('No citations detected')

  // freshnessPoints (0–25)
  let freshnessPoints = 0
  if (hoursAgo === null) {
    reasons.push('No freshness timestamp')
  } else if (hoursAgo <= 6) freshnessPoints = 25
  else if (hoursAgo <= 12) freshnessPoints = 22
  else if (hoursAgo <= 24) freshnessPoints = 18
  else if (hoursAgo <= 72) freshnessPoints = 12
  else if (hoursAgo <= 168) freshnessPoints = 6
  else {
    freshnessPoints = 0
    reasons.push('Sources stale')
  }

  // hypothesesPenalty (0–15)
  const hypothesesPenalty = Math.min(15, hypotheses * 3)
  if (hypotheses > 0) reasons.push('Contains hypotheses that require verification')

  const score = clamp(citationsPoints + freshnessPoints - hypothesesPenalty, 0, 100)

  let grade: ReportQuality['grade'] = 'framework_only'
  if (citations === 0) grade = 'framework_only'
  else if (score >= 85) grade = 'excellent'
  else if (score >= 70) grade = 'good'
  else if (score >= 50) grade = 'needs_attention'
  else grade = 'framework_only'

  return {
    citations,
    hypotheses,
    lastRefreshedLabel,
    score,
    grade,
    breakdown: {
      citationsPoints,
      freshnessPoints,
      hypothesesPenalty,
      maxPoints: 100,
      reasons,
    },
  }
}

