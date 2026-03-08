// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    throw new Error('Supabase not configured for tests')
  },
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => null),
}))

class IO {
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe('LandingClient', () => {
  it('renders premium positioning and proof/migration sections', async () => {
    ;(globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver = IO as unknown as IntersectionObserver

    const LandingClient = (await import('./LandingClient')).default
    render(<LandingClient />)

    expect(screen.getByText('Why-now signals for outbound teams. Send-ready outreach in minutes.')).toBeTruthy()
    expect(screen.getByText(/Why teams switch to LeadIntel/i)).toBeTruthy()
    expect(screen.getByText(/How LeadIntel works/i)).toBeTruthy()
    expect(screen.getByText(/Why LeadIntel feels different in practice/i)).toBeTruthy()
    expect(screen.getByText(/Common switching paths/i)).toBeTruthy()
    expect(screen.getByText(/Proof you can inspect today/i)).toBeTruthy()
  })
})

