// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlurredPremiumSection } from './BlurredPremiumSection'

describe('BlurredPremiumSection', () => {
  it('renders upgrade, pricing, and continue-working CTAs', () => {
    render(
      <BlurredPremiumSection
        title="Generated pitch preview (locked on Free)"
        preview="Preview content"
        upgradeHref="/pricing?target=closer"
      />
    )

    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See pricing' })).toHaveAttribute('href', '/pricing')
    expect(screen.getByRole('link', { name: 'Continue in Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByText(/Unlock path: Closer or higher plan/i)).toBeInTheDocument()
  })
})
