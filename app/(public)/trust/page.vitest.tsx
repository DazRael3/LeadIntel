// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

describe('/trust', () => {
  it('renders Trust Center index with key links', async () => {
    const Page = (await import('./page')).default
    render(<Page />)

    expect(screen.getByText(/Trust Center/i)).toBeTruthy()
    expect(screen.getByText(/Trust summary/i)).toBeTruthy()
    expect(screen.getByText(/What larger teams usually ask about/i)).toBeTruthy()
    expect(screen.getByText(/Current trust posture/i)).toBeTruthy()

    const mustHave = ['Security', 'Privacy', 'Terms', 'Acceptable Use', 'Subprocessors', 'DPA', 'Status', 'Version', 'Changelog', 'Roadmap']
    for (const label of mustHave) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })
})

