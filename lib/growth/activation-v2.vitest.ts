import { describe, expect, it } from 'vitest'
import { buildActivationV2State } from '@/lib/growth/activation-v2'

describe('activation v2', () => {
  it('starts with target_accounts_added as next step', () => {
    const s = buildActivationV2State({
      targetsCount: 0,
      pitchesCount: 0,
      reportsCount: 0,
      briefsCount: 0,
      scoringViewed: false,
      templatesViewed: false,
      pricingViewed: false,
      trustViewed: false,
    })
    expect(s.nextBestStep).toBe('target_accounts_added')
    expect(s.completed).toBe(false)
  })

  it('advances nextBestStep as completions appear', () => {
    const s = buildActivationV2State({
      targetsCount: 1,
      pitchesCount: 1,
      reportsCount: 0,
      briefsCount: 0,
      scoringViewed: false,
      templatesViewed: false,
      pricingViewed: false,
      trustViewed: false,
    })
    expect(s.nextBestStep).toBe('first_report_preview_generated')
  })

  it('marks completed when all steps completed', () => {
    const s = buildActivationV2State({
      targetsCount: 2,
      pitchesCount: 1,
      reportsCount: 1,
      briefsCount: 1,
      scoringViewed: true,
      templatesViewed: true,
      pricingViewed: true,
      trustViewed: true,
    })
    expect(s.completed).toBe(true)
    expect(s.completedCount).toBe(s.totalCount)
    expect(s.nextBestStep).toBe(null)
  })
})

