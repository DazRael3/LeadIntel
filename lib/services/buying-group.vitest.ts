import { describe, expect, it } from 'vitest'
import { deriveBuyingGroup } from '@/lib/services/buying-group'
import type { PersonaRecommendationSummary } from '@/lib/domain/people'

describe('deriveBuyingGroup', () => {
  it('builds a priority order and rationale from persona recommendations', () => {
    const rec: PersonaRecommendationSummary = {
      items: [
        {
          persona: 'Director RevOps',
          category: 'champion',
          priority: 1,
          whyRecommended: ['First-party activity suggests active evaluation.'],
          whyNowAngle: 'Use timing.',
          likelyPain: 'Routing.',
          openingDirection: 'Short.',
          suggestedFirstTouch: { channel: 'email', text: 'Hello' },
          limitations: [],
        },
        {
          persona: 'VP Sales',
          category: 'economic_buyer',
          priority: 2,
          whyRecommended: ['Funding signal maps to pipeline urgency.'],
          whyNowAngle: 'Execution speed.',
          likelyPain: 'Pipeline.',
          openingDirection: 'Ask one question.',
          suggestedFirstTouch: { channel: 'email', text: 'Hello' },
          limitations: [],
        },
      ],
      topPersonas: ['Director RevOps', 'VP Sales'],
      champion: 'Director RevOps',
      economicBuyer: 'VP Sales',
      evaluator: null,
      evidence: { topSignalTypes: [], mostRecentSignalAt: null, momentum: null, firstPartyVisitorCount14d: 2 },
      confidence: 'usable',
    }

    const bg = deriveBuyingGroup(rec)
    expect(bg.priorityOrder[0]).toBe('Director RevOps')
    expect(bg.rationale['VP Sales']?.length).toBeGreaterThan(0)
    expect(bg.confidence).toBe('usable')
  })
})

