import { describe, expect, test } from 'vitest'
import { buildCrmHandoffPayload, buildSequencerHandoffPayload } from '@/lib/services/destination-payloads'
import type { AccountExplainability } from '@/lib/data/getAccountExplainability'

function baseExplainability(): AccountExplainability {
  const now = new Date().toISOString()
  return {
    account: {
      id: 'lead_123',
      name: 'Acme',
      domain: 'acme.com',
      url: 'https://acme.com',
      createdAt: now,
      updatedAt: now,
    },
    signals: [
      {
        id: 'sig_1',
        type: 'funding',
        title: 'Funding round announced',
        summary: null,
        detectedAt: now,
        occurredAt: now,
        sourceName: 'news',
        sourceUrl: 'https://news.example/funding',
        confidence: 0.85,
      },
    ],
    scoreExplainability: {
      score: 78,
      reasons: ['Strong recent signals'],
      breakdown: [{ label: 'Recency', points: 10 }],
      updatedAt: now,
    },
    momentum: {
      window: '30d',
      currentScore: 78,
      priorScore: 70,
      delta: 8,
      label: 'rising',
      topSignalTypes: [{ type: 'funding', count: 1 }],
      highSignalEvents: 2,
      mostRecentSignalAt: now,
      mostRecentHighImpactEvent: { title: 'Funding round announced', detectedAt: now, sourceUrl: 'https://news.example/funding' },
    },
    firstPartyIntent: {
      visitorMatches: { count: 2, lastVisitedAt: now, sampleReferrers: ['google.com'] },
      summary: { label: 'active_research', labelText: 'Active research', summary: 'Returning visitors', freshnessDays: 2 },
    },
    dataQuality: {
      quality: 'usable',
      freshness: 'recent',
      lastObservedAt: now,
      coverage: {
        signalEventsCount: 1,
        uniqueSignalTypesCount: 1,
        hasFirstPartyMatch: true,
        firstPartyVisitorCount14d: 2,
      },
      completeness: { hasScoreReasons: true, hasMomentum: true, hasPeopleRecommendations: true },
      limitations: [],
      operatorNotes: [],
    },
    sourceHealth: { window: '30d', lastSignalAt: now, lastFirstPartyAt: now, freshness: 'recent', notes: [] },
    people: {
      personas: {
        items: [
          {
            persona: 'VP Sales',
            category: 'champion',
            priority: 1,
            whyRecommended: ['Owns pipeline'],
            whyNowAngle: 'Timing is strong based on signals.',
            likelyPain: 'Pipeline coverage risk',
            openingDirection: 'Tie signals to pipeline targets',
            suggestedFirstTouch: { channel: 'email', text: 'Noticed the recent signals—thought you’d want a fast read.' },
            limitations: [],
          },
        ],
        topPersonas: ['VP Sales'],
        champion: 'VP Sales',
        economicBuyer: 'CRO',
        evaluator: null,
        evidence: {
          topSignalTypes: [{ type: 'funding', count: 1 }],
          mostRecentSignalAt: now,
          momentum: { label: 'rising', delta: 8 },
          firstPartyVisitorCount14d: 2,
        },
        confidence: 'usable',
      },
      buyingGroup: {
        champion: 'VP Sales',
        economicBuyer: 'CRO',
        evaluator: null,
        influencers: [],
        priorityOrder: ['VP Sales', 'CRO'],
        rationale: {},
        confidence: 'usable',
        limitations: [],
      },
    },
  }
}

describe('destination-payloads', () => {
  test('buildCrmHandoffPayload is concise and versioned', () => {
    const payload = buildCrmHandoffPayload({
      explainability: baseExplainability(),
      companyName: 'Acme',
      mode: 'task',
      briefReportId: 'rpt_1',
    })

    expect(payload.version).toBe(1)
    expect(payload.kind).toBe('crm_handoff')
    expect(payload.account.companyName).toBe('Acme')
    expect(payload.crm.body.length).toBeGreaterThan(50)
    expect(payload.crm.body.length).toBeLessThanOrEqual(4000)
  })

  test('buildSequencerHandoffPayload includes opener and limitations note when limited', () => {
    const ex = baseExplainability()
    ex.dataQuality.quality = 'limited'
    ex.dataQuality.limitations = ['Limited source coverage']

    const payload = buildSequencerHandoffPayload({
      explainability: ex,
      companyName: 'Acme',
      opener: 'Hello — quick note about the timing.',
      followupAngle: 'Tie the signal to pipeline urgency.',
      targetPersona: 'VP Sales',
    })

    expect(payload.version).toBe(1)
    expect(payload.kind).toBe('sequencer_handoff')
    expect(payload.sequencer.opener).toContain('Hello')
    expect(payload.sequencer.limitationsNote).toContain('Limitations')
  })
})

