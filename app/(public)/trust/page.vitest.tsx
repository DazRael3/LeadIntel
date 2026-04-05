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

describe('/trust', () => {
  it('renders Trust Center index with key links', async () => {
    ;(globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver = IO as unknown as IntersectionObserver
    const Page = (await import('./page')).default
    render(<Page />)

    expect(screen.getByRole('heading', { name: /Trust Center/i })).toBeTruthy()
    expect(screen.getByText(/Trust summary/i)).toBeTruthy()
    expect(screen.getByText(/What larger teams usually ask about/i)).toBeTruthy()
    expect(screen.getByText(/Current trust posture/i)).toBeTruthy()

    const mustHave = ['Security', 'Privacy', 'Terms', 'Acceptable Use', 'Subprocessors', 'DPA', 'Status', 'Version', 'Changelog', 'Roadmap']
    for (const label of mustHave) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })
})

