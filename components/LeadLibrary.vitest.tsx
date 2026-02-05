// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { LeadLibrary } from './LeadLibrary'

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

  it('Starter with 0 leads used → 0 of 3 leads • 3 credits remaining', () => {
    mockUseLeadLibrary.mockReturnValue({
      leads: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<LeadLibrary isPro={false} creditsRemaining={123} />)
    expect(screen.getByText(/0 of 3 leads • 3 credits remaining/i)).toBeTruthy()
  })

  it('Starter with 2 leads used → 2 of 3 leads • 1 credits remaining', () => {
    mockUseLeadLibrary.mockReturnValue({
      leads: makeLeads(2),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<LeadLibrary isPro={false} creditsRemaining={123} />)
    expect(screen.getByText(/2 of 3 leads • 1 credits remaining/i)).toBeTruthy()
  })

  it('Starter with 3+ leads used → 3 of 3 leads • 0 credits remaining (clamped)', () => {
    mockUseLeadLibrary.mockReturnValue({
      leads: makeLeads(5),
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<LeadLibrary isPro={false} creditsRemaining={123} />)
    expect(screen.getByText(/3 of 3 leads • 0 credits remaining/i)).toBeTruthy()
  })
})

