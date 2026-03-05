export type SignalEvent = {
  id: string
  type: string
  title: string
  summary: string | null
  occurredAt: string | null
  detectedAt: string
  sourceName: string | null
  sourceUrl: string | null
  confidence: number | null
  raw?: Record<string, unknown>
}

export type ScoreExplainability = {
  score: number
  reasons: string[]
  breakdown?: Array<{ label: string; points: number; description?: string }>
  updatedAt?: string
}

export function formatSignalType(type: string): string {
  const v = type.trim().toLowerCase()
  if (v === 'new_hires' || v === 'leadership_change') return 'Hiring spike'
  if (v === 'product_launch') return 'Product launch'
  if (v === 'market_expansion' || v === 'expansion') return 'Expansion'
  if (v === 'partnership') return 'Partnership'
  if (v === 'funding') return 'Funding'
  if (v === 'layoffs') return 'Layoffs'
  if (v === 'regulatory') return 'Regulatory'
  if (v === 'earnings') return 'Earnings'
  return v
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function formatRelativeDate(dateIso: string): string {
  const ts = Date.parse(dateIso)
  if (!Number.isFinite(ts)) return dateIso
  const diffMs = Date.now() - ts
  const sec = Math.round(diffMs / 1000)
  const abs = Math.abs(sec)

  const mins = Math.round(abs / 60)
  const hours = Math.round(abs / 3600)
  const days = Math.round(abs / 86400)

  const suffix = sec >= 0 ? 'ago' : 'from now'
  if (abs < 60) return `${abs}s ${suffix}`
  if (mins < 60) return `${mins}m ${suffix}`
  if (hours < 48) return `${hours}h ${suffix}`
  return `${days}d ${suffix}`
}

export function safeExternalLink(url: string | null | undefined): string | null {
  const raw = (url ?? '').trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

