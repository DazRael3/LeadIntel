import type { FirstPartyIntent, FirstPartyIntentSummary } from '@/lib/domain/explainability'

function daysBetweenNow(iso: string): number | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const diffDays = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000))
  return diffDays >= 0 ? diffDays : 0
}

export function deriveFirstPartyIntentSummary(intent: Pick<FirstPartyIntent, 'visitorMatches'>): FirstPartyIntentSummary {
  const count = Math.max(0, Math.floor(intent.visitorMatches.count))
  const lastVisitedAt = intent.visitorMatches.lastVisitedAt
  const freshnessDays = lastVisitedAt ? daysBetweenNow(lastVisitedAt) : null

  if (count <= 0 || !lastVisitedAt || freshnessDays === null) {
    return {
      label: 'none',
      labelText: 'No first-party intent yet',
      summary: 'No matched website visitor activity for this account yet.',
      freshnessDays: null,
    }
  }

  // Deterministic label bands:
  // - active_research: meaningful repeat activity and very recent
  // - returning_interest: repeat activity with recent but not “right now”
  // - early_intent: light activity signal
  const hoursAgo = (Date.now() - Date.parse(lastVisitedAt)) / (60 * 60 * 1000)
  const isVeryRecent = Number.isFinite(hoursAgo) && hoursAgo <= 24

  if (count >= 4 && isVeryRecent) {
    return {
      label: 'active_research',
      labelText: 'Active research',
      summary: `Matched website activity looks active (last 24h; ${count} recent visits).`,
      freshnessDays,
    }
  }

  if (count >= 2) {
    return {
      label: 'returning_interest',
      labelText: 'Returning interest',
      summary: `Matched website activity is returning (${count} recent visits).`,
      freshnessDays,
    }
  }

  return {
    label: 'early_intent',
    labelText: 'Early intent',
    summary: 'Light first-party activity detected. Treat as early interest until it repeats.',
    freshnessDays,
  }
}

