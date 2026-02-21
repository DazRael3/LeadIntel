export function getUpdateText(lastUpdated: Date | null | undefined): string {
  if (!lastUpdated) return 'Never updated yet'

  const diffMs = Date.now() - lastUpdated.getTime()
  if (!Number.isFinite(diffMs) || diffMs < 10_000) return 'Updated just now'
  if (diffMs < 60_000) return 'Updated less than a minute ago'

  if (diffMs < 60 * 60_000) {
    const minutes = Math.floor(diffMs / 60_000)
    if (minutes === 1) return 'Updated 1 minute ago'
    return `Updated ${minutes} minutes ago`
  }

  const hours = Math.floor(diffMs / (60 * 60_000))
  if (hours === 1) return 'Updated 1 hour ago'
  return `Updated ${hours} hours ago`
}

