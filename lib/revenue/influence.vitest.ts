import { describe, expect, test } from 'vitest'
import { derivePipelineInfluenceLabel } from '@/lib/revenue/influence'

describe('pipeline influence', () => {
  test('confirmed progression when meeting booked', () => {
    const res = derivePipelineInfluenceLabel({
      hasFirstParty: true,
      momentumLabel: 'rising',
      deliveredActionsCount: 0,
      preparedActionsCount: 0,
      outcomes: ['meeting_booked'],
      dataQuality: 'usable',
      freshness: 'recent',
    })
    expect(res.label).toBe('confirmed_progression')
  })

  test('building when rising with usable evidence', () => {
    const res = derivePipelineInfluenceLabel({
      hasFirstParty: false,
      momentumLabel: 'rising',
      deliveredActionsCount: 0,
      preparedActionsCount: 0,
      outcomes: [],
      dataQuality: 'usable',
      freshness: 'recent',
    })
    expect(res.label).toBe('building')
  })

  test('unknown when no activity', () => {
    const res = derivePipelineInfluenceLabel({
      hasFirstParty: false,
      momentumLabel: 'steady',
      deliveredActionsCount: 0,
      preparedActionsCount: 0,
      outcomes: [],
      dataQuality: 'limited',
      freshness: 'unknown',
    })
    expect(res.label).toBe('unknown')
  })
})

