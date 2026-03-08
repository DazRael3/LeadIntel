// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

describe('/compare/[slug]', () => {
  it('renders required sections for modern competitor pages', async () => {
    const Page = (await import('./page')).default
    const el = await Page({ params: Promise.resolve({ slug: 'leadintel-vs-usergems' }) })
    render(el)

    expect(screen.getByText(/Quick verdict/i)).toBeTruthy()
    expect(screen.getByText(/Where LeadIntel is better/i)).toBeTruthy()
    expect(screen.getByText(/Where UserGems is stronger/i)).toBeTruthy()
    expect(screen.getByText(/Comparison table/i)).toBeTruthy()
    expect(screen.getByText(/Final recommendation/i)).toBeTruthy()
  })
})

