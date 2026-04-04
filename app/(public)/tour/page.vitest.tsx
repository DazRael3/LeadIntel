// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

describe('/tour', () => {
  it('renders interactive preview with deeper account blocks', async () => {
    ;(globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver =
      (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver ??
      (class {
        observe() {}
        disconnect() {}
        unobserve() {}
      } as unknown as IntersectionObserver)

    const Page = (await import('./page')).default
    render(<Page />)

    expect(screen.getByRole('heading', { name: /Product tour/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^Interactive product preview$/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /^People$/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /^Signal timeline$/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /^Action center$/i })).toBeTruthy()
  })
})

