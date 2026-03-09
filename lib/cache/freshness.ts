export type FreshnessLabel = 'fresh' | 'recent' | 'stale' | 'unknown'

export function ageDays(iso: string): number | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  return Math.max(0, (Date.now() - ms) / (24 * 3600 * 1000))
}

export function freshnessForAgeDays(days: number | null): FreshnessLabel {
  if (days == null) return 'unknown'
  if (days <= 2) return 'fresh'
  if (days <= 7) return 'recent'
  return 'stale'
}

export function freshnessForIso(lastObservedAt: string | null): { label: FreshnessLabel; ageDays: number | null } {
  if (!lastObservedAt) return { label: 'unknown', ageDays: null }
  const days = ageDays(lastObservedAt)
  return { label: freshnessForAgeDays(days), ageDays: days }
}

