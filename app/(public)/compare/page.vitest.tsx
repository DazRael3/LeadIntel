// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

class IO {
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe('/compare', () => {
  it('renders competitor matrix and ranked entries', async () => {
    ;(globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver = IO as unknown as IntersectionObserver

    const Page = (await import('./page')).default
    render(<Page />)

    expect(screen.getByRole('heading', { name: /competitor matrix/i })).toBeTruthy()
    expect(screen.getByText('UserGems')).toBeTruthy()
    expect(screen.getByText('Common Room')).toBeTruthy()
    expect(screen.getByText('ZoomInfo Copilot')).toBeTruthy()
    expect(screen.getByText('Apollo')).toBeTruthy()
    expect(screen.getAllByText('LeadIntel').length).toBeGreaterThan(0)
  })
})

