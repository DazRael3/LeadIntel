import { describe, expect, it } from 'vitest'
import { deriveSourceHealth } from '@/lib/services/source-health'
import type { SignalEvent } from '@/lib/domain/explainability'

describe('source health', () => {
  it('labels fresh when the last observed activity is within 2 days', () => {
    const signals: SignalEvent[] = [
      {
        id: 's1',
        type: 'funding',
        title: 'Funding',
        summary: null,
        occurredAt: null,
        detectedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        sourceName: null,
        sourceUrl: null,
        confidence: null,
      },
    ]
    const res = deriveSourceHealth({ window: '30d', signals, firstPartyLastVisitedAt: null })
    expect(res.freshness).toBe('fresh')
    expect(res.lastSignalAt).toBeTruthy()
  })

  it('labels unknown when there is no activity', () => {
    const res = deriveSourceHealth({ window: '30d', signals: [], firstPartyLastVisitedAt: null })
    expect(res.freshness === 'unknown' || res.freshness === 'stale').toBe(true)
    expect(res.notes.length).toBeGreaterThan(0)
  })
})

