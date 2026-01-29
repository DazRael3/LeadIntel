import { describe, it, expect } from 'vitest'
import { getEntitlements, hasEverHadTrial, isEligibleForNewTrial } from './entitlements'

describe('getEntitlements', () => {
  it('pro users can access history and export', () => {
    const e = getEntitlements({ plan: 'pro', trial: { active: false, endsAt: null } }, 0)
    expect(e.canUseCommandCenter).toBe(true)
    expect(e.canAccessPitchHistory).toBe(true)
    expect(e.canExportLeads).toBe(true)
    expect(e.isTrialExpiredNonPro).toBe(false)
  })

  it('active trial grants access', () => {
    const now = Date.parse('2025-01-01T00:00:00Z')
    const endsAt = '2025-01-02T00:00:00Z'
    const e = getEntitlements({ plan: 'free', trial: { active: true, endsAt } }, now)
    expect(e.isTrialActive).toBe(true)
    expect(e.canAccessPitchHistory).toBe(true)
  })

  it('free users without active trial are locked', () => {
    const now = Date.parse('2025-01-03T00:00:00Z')
    const endsAt = '2025-01-02T00:00:00Z'
    const e = getEntitlements({ plan: 'free', trial: { active: true, endsAt } }, now)
    expect(e.isTrialActive).toBe(false)
    expect(e.canAccessPitchHistory).toBe(false)
    expect(e.isTrialExpiredNonPro).toBe(true)
  })
})

describe('trial eligibility helpers', () => {
  it('hasEverHadTrial(user) is true when user.trial_ends_at is set', () => {
    expect(hasEverHadTrial({ trial_ends_at: '2025-01-01T00:00:00Z' })).toBe(true)
    expect(hasEverHadTrial({ trial_ends_at: null })).toBe(false)
  })

  it('hasEverHadTrial(subscriptions) is true when any trial_end is set', () => {
    expect(hasEverHadTrial([{ trial_end: null }, { trial_end: '2025-01-01T00:00:00Z' }])).toBe(true)
    expect(hasEverHadTrial([{ trial_end: null }, { trial_end: null }])).toBe(false)
  })

  it('isEligibleForNewTrial is false if account has ever had trial (user or subs)', () => {
    expect(isEligibleForNewTrial({ trial_ends_at: '2025-01-01T00:00:00Z' }, [])).toBe(false)
    expect(isEligibleForNewTrial({ trial_ends_at: null }, [{ trial_end: '2025-01-01T00:00:00Z' }])).toBe(false)
    expect(isEligibleForNewTrial({ trial_ends_at: null }, [])).toBe(true)
  })
})

