import { describe, it, expect } from 'vitest'

import { computeStarterLeadUsage } from './leads-usage'

describe('computeStarterLeadUsage', () => {
  it('Starter with 0 leads used → 0 of 3 leads • 3 credits remaining', () => {
    const u = computeStarterLeadUsage(0)
    expect(u.maxLeads).toBe(3)
    expect(u.leadsUsed).toBe(0)
    expect(u.creditsRemaining).toBe(3)
  })

  it('Starter with 2 leads used → 2 of 3 leads • 1 credits remaining', () => {
    const u = computeStarterLeadUsage(2)
    expect(u.maxLeads).toBe(3)
    expect(u.leadsUsed).toBe(2)
    expect(u.creditsRemaining).toBe(1)
  })

  it('Starter with 3+ leads used → 3 of 3 leads • 0 credits remaining (clamped)', () => {
    const u = computeStarterLeadUsage(5)
    expect(u.maxLeads).toBe(3)
    expect(u.leadsUsed).toBe(3)
    expect(u.creditsRemaining).toBe(0)
  })
})

