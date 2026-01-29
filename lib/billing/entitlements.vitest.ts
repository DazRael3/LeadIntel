import { describe, it, expect } from 'vitest'
import { getEntitlements } from './entitlements'

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

