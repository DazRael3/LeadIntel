import { describe, expect, it } from 'vitest'
import { defaultOnboardingState, deriveOnboardingStep, type OnboardingSignals } from '@/lib/onboarding/model'

function baseSignals(overrides?: Partial<OnboardingSignals>): OnboardingSignals {
  return {
    targetsCount: 0,
    pitchesCount: 0,
    reportsCount: 0,
    hasViewedScoringExplainer: false,
    hasSavedBrief: false,
    hasViewedPricing: false,
    hasViewedTrust: false,
    ...(overrides ?? {}),
  }
}

describe('onboarding model', () => {
  it('stays on step 1 when goal missing', () => {
    const step = deriveOnboardingStep({ goal: null, workflow: null }, baseSignals({ targetsCount: 5 }))
    expect(step).toBe(1)
  })

  it('moves to step 2 when no targets', () => {
    const step = deriveOnboardingStep({ goal: 'track_target_accounts', workflow: null }, baseSignals({ targetsCount: 0 }))
    expect(step).toBe(2)
  })

  it('moves to step 3 when goal set and targets exist but workflow missing', () => {
    const step = deriveOnboardingStep({ goal: 'track_target_accounts', workflow: null }, baseSignals({ targetsCount: 3 }))
    expect(step).toBe(3)
  })

  it('moves to step 4 for pitch workflow until pitch exists', () => {
    const step1 = deriveOnboardingStep({ goal: 'generate_outreach_faster', workflow: 'pitch' }, baseSignals({ targetsCount: 3, pitchesCount: 0 }))
    expect(step1).toBe(4)
    const step2 = deriveOnboardingStep({ goal: 'generate_outreach_faster', workflow: 'pitch' }, baseSignals({ targetsCount: 3, pitchesCount: 1 }))
    expect(step2).toBe(5)
  })

  it('moves to step 4 for report workflow until report exists', () => {
    const step1 = deriveOnboardingStep({ goal: 'evaluate_competitive_accounts', workflow: 'report' }, baseSignals({ targetsCount: 3, reportsCount: 0 }))
    expect(step1).toBe(4)
    const step2 = deriveOnboardingStep({ goal: 'evaluate_competitive_accounts', workflow: 'report' }, baseSignals({ targetsCount: 3, reportsCount: 1 }))
    expect(step2).toBe(5)
  })

  it('keeps daily_shortlist at step 4 when targets exist', () => {
    const step = deriveOnboardingStep({ goal: 'build_daily_shortlist', workflow: 'daily_shortlist' }, baseSignals({ targetsCount: 3 }))
    expect(step).toBe(4)
  })

  it('default state uses the max of persisted and derived steps', () => {
    const a = defaultOnboardingState({
      goal: 'track_target_accounts',
      workflow: null,
      step: 1,
      completed: false,
      signals: baseSignals({ targetsCount: 5 }),
    })
    expect(a.step).toBe(3)

    const b = defaultOnboardingState({
      goal: 'track_target_accounts',
      workflow: 'pitch',
      step: 2,
      completed: false,
      signals: baseSignals({ targetsCount: 5, pitchesCount: 1 }),
    })
    expect(b.step).toBe(5)
  })
})

