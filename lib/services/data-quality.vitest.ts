import { describe, expect, it } from 'vitest'
import { deriveAccountDataQuality, deriveReportSourceQuality } from '@/lib/services/data-quality'
import type { FirstPartyIntent, SignalEvent, SignalMomentum, ScoreExplainability } from '@/lib/domain/explainability'

function base(args?: Partial<{ signals: SignalEvent[]; lastVisitedAt: string | null; momentum: SignalMomentum | null }>) {
  const signals: SignalEvent[] =
    args?.signals ??
    [
      {
        id: 's1',
        type: 'funding',
        title: 'Funding round',
        summary: null,
        occurredAt: null,
        detectedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        sourceName: null,
        sourceUrl: 'https://example.com',
        confidence: null,
      },
      {
        id: 's2',
        type: 'new_hires',
        title: 'Hiring spike',
        summary: null,
        occurredAt: null,
        detectedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        sourceName: null,
        sourceUrl: 'https://example.com/2',
        confidence: null,
      },
    ]

  const scoreExplainability: ScoreExplainability = { score: 80, reasons: ['Recent funding signal.'] }
  const momentum: SignalMomentum | null =
    args?.momentum ??
    ({
      window: '30d',
      currentScore: 82,
      priorScore: 70,
      delta: 12,
      label: 'rising',
      topSignalTypes: [{ type: 'funding', count: 1 }],
      highSignalEvents: 1,
      mostRecentSignalAt: signals[0]?.detectedAt ?? null,
      mostRecentHighImpactEvent: null,
    } satisfies SignalMomentum)

  const firstPartyIntent: FirstPartyIntent = {
    visitorMatches: { count: args?.lastVisitedAt ? 2 : 0, lastVisitedAt: args?.lastVisitedAt ?? null, sampleReferrers: [] },
    summary: { label: 'none', labelText: 'No first-party intent yet', summary: '—', freshnessDays: null },
  }

  return { signals, scoreExplainability, momentum, firstPartyIntent, people: null }
}

describe('data quality', () => {
  it('marks strong quality when signals are diverse and fresh', () => {
    const x = base({ lastVisitedAt: new Date().toISOString() })
    const q = deriveAccountDataQuality(x)
    expect(q.quality).toBe('strong')
    expect(q.freshness === 'fresh' || q.freshness === 'recent').toBe(true)
  })

  it('marks limited when there are no signals and few reasons', () => {
    const q = deriveAccountDataQuality({
      signals: [],
      scoreExplainability: { score: 10, reasons: [] },
      momentum: null,
      firstPartyIntent: { visitorMatches: { count: 0, lastVisitedAt: null, sampleReferrers: [] }, summary: { label: 'none', labelText: 'No first-party intent yet', summary: '—', freshnessDays: null } },
      people: null,
    })
    expect(q.quality).toBe('limited')
    expect(q.limitations.length).toBeGreaterThan(0)
  })

  it('report source quality derives from citations and freshness only', () => {
    const s = deriveReportSourceQuality({
      citationsCount: 2,
      sourcesFetchedAt: new Date().toISOString(),
      meta: { internalSignalsCount: 3 },
    })
    expect(s.quality).toBe('usable')
    expect(s.citationsCount).toBe(2)
    expect(s.internalSignalsCount).toBe(3)
  })
})

