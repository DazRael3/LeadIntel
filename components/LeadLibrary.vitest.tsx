// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { LeadLibrary } from './LeadLibrary'
import { STARTER_MAX_LEADS } from '@/lib/billing/leads-usage'

const mockUseLeadLibrary = vi.fn()

vi.mock('@/app/dashboard/hooks/useLeadLibrary', () => ({
  useLeadLibrary: () => mockUseLeadLibrary(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}))

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

type LeadLike = {
  id: string
  company_name: string
  trigger_event: string
  ai_personalized_pitch: string
  created_at: string
}

function makeLeads(n: number): LeadLike[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `l${i + 1}`,
    company_name: `Company ${i + 1}`,
    trigger_event: '—',
    ai_personalized_pitch: 'pitch',
    created_at: new Date().toISOString(),
  }))
}

describe('LeadLibrary usage header (Starter)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`Starter with 0 leads used → 0 of ${STARTER_MAX_LEADS} leads • ${STARTER_MAX_LEADS} credits remaining`, () => {
    mockUseLeadLibrary.mockReturnValue({
      leads: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<LeadLibrary isPro={false} creditsRemaining={123} />)
    expect(
      screen.getByText(new RegExp(`0 of ${STARTER_MAX_LEADS} leads • ${STARTER_MAX_LEADS} credits remaining`, 'i'))
    ).toBeTruthy()
  })

  it(`Starter with 2 leads used → 2 of ${STARTER_MAX_LEADS} leads • 1 credits remaining`, () => {
    mockUseLeadLibrary.mockReturnValue({
      leads: makeLeads(2),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<LeadLibrary isPro={false} creditsRemaining={123} />)
    expect(screen.getByText(new RegExp(`2 of ${STARTER_MAX_LEADS} leads • 1 credits remaining`, 'i'))).toBeTruthy()
  })

  it(`Starter with 3+ leads used → ${STARTER_MAX_LEADS} of ${STARTER_MAX_LEADS} leads • 0 credits remaining (clamped)`, () => {
    mockUseLeadLibrary.mockReturnValue({
      leads: makeLeads(5),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<LeadLibrary isPro={false} creditsRemaining={123} />)
    expect(
      screen.getByText(new RegExp(`${STARTER_MAX_LEADS} of ${STARTER_MAX_LEADS} leads • 0 credits remaining`, 'i'))
    ).toBeTruthy()
    // Starter visibility cap: leads beyond the first 3 must not render at all.
    expect(screen.queryByText(/Company 4/i)).toBeNull()
    expect(screen.queryByText(/Company 5/i)).toBeNull()
  })
})

