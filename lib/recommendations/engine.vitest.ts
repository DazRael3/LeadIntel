import { describe, expect, test } from 'vitest'
import { buildAccountRecommendationBundle, RECOMMENDATION_ENGINE_VERSION } from '@/lib/recommendations/engine'
import type { RecommendationInputs } from '@/lib/recommendations/types'

const baseInputs: RecommendationInputs = {
  window: '30d',
  scoreExplainability: { score: 62, reasons: ['recent_event'] },
  momentum: {
    window: '30d',
    currentScore: 12,
    priorScore: 2,
    delta: 10,
    label: 'rising',
    topSignalTypes: [{ type: 'funding', count: 2 }],
    highSignalEvents: 1,
    mostRecentSignalAt: new Date().toISOString(),
    mostRecentHighImpactEvent: { title: 'Funding round announced', detectedAt: new Date().toISOString(), sourceUrl: null },
  },
  firstPartyIntent: {
    visitorMatches: { count: 2, lastVisitedAt: new Date().toISOString(), sampleReferrers: [] },
    summary: { label: 'active_research', labelText: 'Active research', summary: 'Visitors matched', freshnessDays: 1 },
  },
  dataQuality: {
    quality: 'usable',
    freshness: 'recent',
    lastObservedAt: new Date().toISOString(),
    coverage: { signalEventsCount: 4, uniqueSignalTypesCount: 2, hasFirstPartyMatch: true, firstPartyVisitorCount14d: 2 },
    completeness: { hasScoreReasons: true, hasMomentum: true, hasPeopleRecommendations: true },
    limitations: [],
    operatorNotes: [],
  },
  sourceHealth: { window: '30d', lastSignalAt: new Date().toISOString(), lastFirstPartyAt: new Date().toISOString(), freshness: 'recent', notes: [] },
  people: { items: [], topPersonas: ['Director RevOps'], champion: 'Director RevOps', economicBuyer: null, evaluator: null, evidence: { topSignalTypes: [], mostRecentSignalAt: null, momentum: null, firstPartyVisitorCount14d: 2 }, confidence: 'usable' },
  account: { id: '00000000-0000-0000-0000-000000000001', name: 'Acme', domain: 'acme.com' },
}

describe('recommendations engine', () => {
  test('returns explainable bundle with version and bounded priority', () => {
    const { bundle } = buildAccountRecommendationBundle({ inputs: baseInputs, learning: { feedback: null, outcomes: null }, previousSnapshot: null })
    expect(bundle.targetId).toBe(baseInputs.account.id)
    expect(bundle.recommendations.length).toBeGreaterThan(0)
    expect(bundle.recommendations[0]?.version).toBe(RECOMMENDATION_ENGINE_VERSION)
    expect(bundle.rank.priorityScore).toBeGreaterThanOrEqual(0)
    expect(bundle.rank.priorityScore).toBeLessThanOrEqual(100)
    expect(bundle.summary.whyNow.length).toBeGreaterThan(0)
  })
})

