// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

describe('/tour', () => {
  it('renders interactive preview with deeper account blocks', async () => {
    const Page = (await import('./page')).default
    render(<Page />)

    expect(screen.getByText(/Product tour/i)).toBeTruthy()
    expect(screen.getByText(/Interactive product preview/i)).toBeTruthy()
    expect(screen.getByText(/People/i)).toBeTruthy()
    expect(screen.getByText(/Signal timeline/i)).toBeTruthy()
    expect(screen.getByText(/Action center/i)).toBeTruthy()
  })
})

