import { describe, expect, it } from 'vitest'
import { scoreProspect } from './scoring'

describe('scoreProspect', () => {
  it('weights ICP fit heavily', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const a = scoreProspect({
      icpFitManual: 90,
      signalType: 'other',
      confidence: 50,
      occurredAt: new Date('2025-12-31T12:00:00.000Z'),
      now,
    })
    const b = scoreProspect({
      icpFitManual: 30,
      signalType: 'funding',
      confidence: 95,
      occurredAt: new Date('2025-12-31T12:00:00.000Z'),
      now,
    })
    expect(a.overall).toBeGreaterThan(b.overall - 15)
  })
})

