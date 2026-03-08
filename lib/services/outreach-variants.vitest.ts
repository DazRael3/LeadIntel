import { describe, expect, test } from 'vitest'
import type { FirstPartyIntent, SignalEvent, SignalMomentum } from '@/lib/domain/explainability'
import type { PersonaRecommendationSummary } from '@/lib/domain/people'
import { buildOutreachVariants } from '@/lib/services/outreach-variants'

function mkSignal(title: string): SignalEvent {
  return {
    id: `sig_${title.toLowerCase().replace(/\s+/g, '_')}`,
    type: 'news',
    title,
    summary: null,
    occurredAt: null,
    detectedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    sourceName: null,
    sourceUrl: null,
    confidence: null,
  }
}

const MOMENTUM: SignalMomentum = {
  window: '30d',
  currentScore: 70,
  priorScore: 60,
  delta: 10,
  label: 'rising',
  topSignalTypes: [{ type: 'news', count: 2 }],
  highSignalEvents: 1,
  mostRecentSignalAt: new Date('2026-01-02T00:00:00.000Z').toISOString(),
  mostRecentHighImpactEvent: null,
}

function mkFirstPartyIntent(count: number, lastVisitedAt: string | null): FirstPartyIntent {
  return {
    visitorMatches: { count, lastVisitedAt, sampleReferrers: [] },
    summary: {
      label: count > 0 ? 'active_research' : 'none',
      labelText: count > 0 ? 'Active research' : 'No first-party intent yet',
      summary: count > 0 ? 'Active research based on recent visitor matches.' : 'No first-party intent yet.',
      freshnessDays: null,
    },
  }
}

const PERSONAS: PersonaRecommendationSummary = {
  confidence: 'usable',
  champion: 'Director RevOps',
  economicBuyer: 'VP Sales',
  evaluator: 'Sales Enablement',
  topPersonas: ['Director RevOps', 'VP Sales'],
  evidence: {
    topSignalTypes: [{ type: 'news', count: 2 }],
    mostRecentSignalAt: new Date('2026-01-02T00:00:00.000Z').toISOString(),
    momentum: { label: 'rising', delta: 10 },
    firstPartyVisitorCount14d: 0,
  },
  items: [
    {
      persona: 'Director RevOps',
      category: 'champion',
      priority: 1,
      whyRecommended: ['Signals suggest workflow change.'],
      whyNowAngle: 'Act while timing is fresh.',
      likelyPain: 'Slow outbound iteration.',
      openingDirection: 'Lead with timing and next step.',
      suggestedFirstTouch: {
        channel: 'email',
        text: 'Noticed a shift on your watchlist. Worth a quick chat about tightening outbound execution this week?',
      },
      limitations: [],
    },
  ],
}

describe('buildOutreachVariants', () => {
  test('includes persona-driven variants when available', () => {
    const variants = buildOutreachVariants({
      companyName: 'ExampleCo',
      personas: PERSONAS,
      momentum: MOMENTUM,
      firstPartyIntent: mkFirstPartyIntent(0, null),
      signals: [mkSignal('Launched a new product page'), mkSignal('Hiring spike in RevOps')],
      maxVariants: 5,
    })
    expect(variants.length).toBeGreaterThan(0)
    expect(variants.some((v) => v.id.startsWith('persona:'))).toBe(true)
    const persona = variants.find((v) => v.id.startsWith('persona:'))
    expect(persona?.opener).toContain('Noticed')
  })

  test('generic opener references only provided top signal title when present', () => {
    const signalTitle = 'Partnership announcement detected'
    const variants = buildOutreachVariants({
      companyName: 'ExampleCo',
      personas: null,
      momentum: MOMENTUM,
      firstPartyIntent: mkFirstPartyIntent(0, null),
      signals: [mkSignal(signalTitle)],
      maxVariants: 2,
    })
    const generic = variants.find((v) => v.id === 'generic:operator')
    expect(generic).toBeTruthy()
    expect(generic?.opener).toContain(signalTitle)
  })

  test('adds a first-party intent variant only when visitor matches exist with recency', () => {
    const none = buildOutreachVariants({
      companyName: 'ExampleCo',
      personas: null,
      momentum: MOMENTUM,
      firstPartyIntent: mkFirstPartyIntent(0, null),
      signals: [mkSignal('Recent press mention')],
      maxVariants: 6,
    })
    expect(none.some((v) => v.id === 'first_party:intent')).toBe(false)

    const some = buildOutreachVariants({
      companyName: 'ExampleCo',
      personas: null,
      momentum: MOMENTUM,
      firstPartyIntent: mkFirstPartyIntent(3, new Date('2026-01-10T00:00:00.000Z').toISOString()),
      signals: [mkSignal('Recent press mention')],
      maxVariants: 6,
    })
    expect(some.some((v) => v.id === 'first_party:intent')).toBe(true)
  })
})

