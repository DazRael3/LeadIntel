import { describe, expect, it } from 'vitest'
import { crossWorkspaceEligibility, crossWorkspaceBucketEligibility, PRIVACY_THRESHOLDS } from '@/lib/benchmarking/privacy'

describe('benchmark privacy eligibility', () => {
  it('suppresses when disabled', () => {
    const e = crossWorkspaceEligibility({ enabled: false, cohortWorkspaces: 999, totalEvents: 9999, windowDays: 30 })
    expect(e.eligible).toBe(false)
    if (!e.eligible) expect(e.reasonCode).toBe('DISABLED')
  })

  it('suppresses when cohort too small', () => {
    const e = crossWorkspaceEligibility({ enabled: true, cohortWorkspaces: PRIVACY_THRESHOLDS.minCohortWorkspaces - 1, totalEvents: 9999, windowDays: 30 })
    expect(e.eligible).toBe(false)
    if (!e.eligible) expect(e.reasonCode).toBe('COHORT_TOO_SMALL')
  })

  it('suppresses when events too low', () => {
    const e = crossWorkspaceEligibility({ enabled: true, cohortWorkspaces: PRIVACY_THRESHOLDS.minCohortWorkspaces, totalEvents: PRIVACY_THRESHOLDS.minTotalEvents - 1, windowDays: 30 })
    expect(e.eligible).toBe(false)
    if (!e.eligible) expect(e.reasonCode).toBe('EVENTS_TOO_LOW')
  })

  it('allows when thresholds met', () => {
    const e = crossWorkspaceEligibility({ enabled: true, cohortWorkspaces: PRIVACY_THRESHOLDS.minCohortWorkspaces, totalEvents: PRIVACY_THRESHOLDS.minTotalEvents, windowDays: 30 })
    expect(e.eligible).toBe(true)
  })

  it('uses bucket thresholds for bucket eligibility', () => {
    const e = crossWorkspaceBucketEligibility({
      enabled: true,
      cohortWorkspaces: PRIVACY_THRESHOLDS.minCohortWorkspaces,
      totalBucketEvents: PRIVACY_THRESHOLDS.minBucketEvents,
      windowDays: 30,
    })
    expect(e.eligible).toBe(true)
  })
})

