// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })) },
  }),
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

    expect(screen.getByRole('heading', { name: /why-now signals for outbound teams/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Why teams switch to LeadIntel/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Evidence, not hype/i })).toBeTruthy()
    expect(screen.getByText(/Proof you can inspect today/i)).toBeTruthy()
  })
})

