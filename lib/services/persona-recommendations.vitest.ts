import { describe, expect, it } from 'vitest'
import { derivePersonaRecommendations } from '@/lib/services/persona-recommendations'
import type { SignalEvent, SignalMomentum } from '@/lib/domain/explainability'

function mkSignal(type: string, title = 'Event'): SignalEvent {
  return {
    id: `sig_${type}`,
    type,
    title,
    summary: null,
    occurredAt: null,
    detectedAt: new Date().toISOString(),
    sourceName: null,
    sourceUrl: null,
    confidence: null,
  }
}

describe('derivePersonaRecommendations', () => {
  it('includes RevOps champion when first-party intent is present', () => {
    const res = derivePersonaRecommendations({
      companyName: 'Acme',
      signals: [],
      momentum: null,
      firstPartyVisitorCount14d: 2,
      userContext: { whatYouSell: null, idealCustomer: null },
    })
    expect(res.topPersonas).toContain('Director RevOps')
    expect(res.champion).toBe('Director RevOps')
    expect(res.confidence).not.toBe('limited')
  })

  it('includes sales leadership for funding signals', () => {
    const res = derivePersonaRecommendations({
      companyName: 'Acme',
      signals: [mkSignal('funding', 'Raised')],
      momentum: null,
      firstPartyVisitorCount14d: 0,
      userContext: { whatYouSell: 'pipeline ops', idealCustomer: 'B2B teams' },
    })
    expect(res.topPersonas).toContain('VP Sales')
    expect(res.items.some((i) => i.persona === 'CRO')).toBe(true)
  })

  it('uses limited confidence when evidence is thin', () => {
    const m: SignalMomentum = {
      window: '30d',
      currentScore: 50,
      priorScore: 50,
      delta: 0,
      label: 'steady',
      topSignalTypes: [],
      highSignalEvents: 0,
      mostRecentSignalAt: null,
    }
    const res = derivePersonaRecommendations({
      companyName: 'Acme',
      signals: [mkSignal('unknown', 'Unclassified')],
      momentum: m,
      firstPartyVisitorCount14d: 0,
      userContext: { whatYouSell: null, idealCustomer: null },
    })
    expect(res.confidence).toBe('limited')
  })
})

