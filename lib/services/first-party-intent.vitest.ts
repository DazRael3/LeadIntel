import { describe, expect, it } from 'vitest'
import { deriveFirstPartyIntentSummary } from '@/lib/services/first-party-intent'

describe('deriveFirstPartyIntentSummary', () => {
  it('returns none when no matches', () => {
    const s = deriveFirstPartyIntentSummary({
      visitorMatches: { count: 0, lastVisitedAt: null, sampleReferrers: [] },
    })
    expect(s.label).toBe('none')
    expect(s.labelText).toBe('No first-party intent yet')
  })

  it('returns early_intent for a single recent match', () => {
    const s = deriveFirstPartyIntentSummary({
      visitorMatches: { count: 1, lastVisitedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), sampleReferrers: [] },
    })
    expect(s.label).toBe('early_intent')
  })

  it('returns active_research for repeat very recent activity', () => {
    const s = deriveFirstPartyIntentSummary({
      visitorMatches: { count: 5, lastVisitedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), sampleReferrers: [] },
    })
    expect(s.label).toBe('active_research')
  })

  it('returns returning_interest for repeat non-zero activity when not very recent', () => {
    const s = deriveFirstPartyIntentSummary({
      visitorMatches: { count: 2, lastVisitedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), sampleReferrers: [] },
    })
    expect(s.label).toBe('returning_interest')
  })
})

