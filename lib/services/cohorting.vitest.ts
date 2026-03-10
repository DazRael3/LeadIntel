import { describe, expect, it } from 'vitest'
import { derivePatternBucket } from '@/lib/services/cohorting'
import type { AccountExplainability } from '@/lib/data/getAccountExplainability'

function makeExplainability(args: { momentum: 'rising' | 'steady' | 'cooling'; intent: 'none' | 'early_intent' | 'active_research' | 'returning_interest'; quality: 'limited' | 'usable' | 'strong' }): AccountExplainability {
  const labelText =
    args.intent === 'none'
      ? 'No first-party intent yet'
      : args.intent === 'early_intent'
        ? 'Early intent'
        : args.intent === 'active_research'
          ? 'Active research'
          : 'Returning interest'
  return {
    account: { id: 'a', name: null, domain: null, url: null, createdAt: null, updatedAt: null },
    signals: [],
    scoreExplainability: { score: 50, reasons: [] },
    momentum: { window: '30d', currentScore: 0, priorScore: 0, delta: 0, label: args.momentum, topSignalTypes: [], highSignalEvents: 0, mostRecentSignalAt: null },
    firstPartyIntent: { visitorMatches: { count: 0, lastVisitedAt: null, sampleReferrers: [] }, summary: { label: args.intent, labelText, summary: '', freshnessDays: null } },
    dataQuality: {
      quality: args.quality,
      freshness: 'unknown',
      lastObservedAt: null,
      coverage: { signalEventsCount: 0, uniqueSignalTypesCount: 0, hasFirstPartyMatch: false, firstPartyVisitorCount14d: 0 },
      completeness: { hasScoreReasons: true, hasMomentum: true, hasPeopleRecommendations: false },
      limitations: [],
      operatorNotes: [],
    },
    sourceHealth: { window: '30d', lastSignalAt: null, lastFirstPartyAt: null, freshness: 'unknown', notes: [] },
    people: {
      personas: {
        confidence: 'limited',
        topPersonas: [],
        champion: null,
        economicBuyer: null,
        evaluator: null,
        items: [],
        evidence: { topSignalTypes: [], mostRecentSignalAt: null, momentum: null, firstPartyVisitorCount14d: 0 },
      },
      buyingGroup: {
        champion: null,
        economicBuyer: null,
        evaluator: null,
        influencers: [],
        priorityOrder: [],
        rationale: {},
        confidence: 'limited',
        limitations: [],
      },
    },
  }
}

describe('derivePatternBucket', () => {
  it('produces stable bucket keys', () => {
    const e = makeExplainability({ momentum: 'rising', intent: 'active_research', quality: 'usable' })
    expect(derivePatternBucket(e)).toBe('mom_rising_intent_active_quality_usable')
  })
})

