import { describe, it, expect } from 'vitest'

import { computeStarterLeadUsage, STARTER_MAX_LEADS } from './leads-usage'

describe('computeStarterLeadUsage', () => {
  it(`Starter with 0 leads used → 0 of ${STARTER_MAX_LEADS} leads • ${STARTER_MAX_LEADS} credits remaining`, () => {
    const u = computeStarterLeadUsage(0)
    expect(u.maxLeads).toBe(STARTER_MAX_LEADS)
    expect(u.leadsUsed).toBe(0)
    expect(u.creditsRemaining).toBe(STARTER_MAX_LEADS)
  })

  it(`Starter with 2 leads used → 2 of ${STARTER_MAX_LEADS} leads • 1 credits remaining`, () => {
    const u = computeStarterLeadUsage(2)
    expect(u.maxLeads).toBe(STARTER_MAX_LEADS)
    expect(u.leadsUsed).toBe(2)
    expect(u.creditsRemaining).toBe(1)
  })

  it(`Starter with 3+ leads used → ${STARTER_MAX_LEADS} of ${STARTER_MAX_LEADS} leads • 0 credits remaining (clamped)`, () => {
    const u = computeStarterLeadUsage(5)
    expect(u.maxLeads).toBe(STARTER_MAX_LEADS)
    expect(u.leadsUsed).toBe(STARTER_MAX_LEADS)
    expect(u.creditsRemaining).toBe(0)
  })
})

