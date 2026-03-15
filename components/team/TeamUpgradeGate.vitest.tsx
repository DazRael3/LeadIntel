import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('TeamUpgradeGate', () => {
  it('renders an H1 and premium locked state', async () => {
    const { TeamUpgradeGate } = await import('./TeamUpgradeGate')
    render(
      <TeamUpgradeGate
        heading="Actions"
        subtitle="Route follow-up work across your team with a shared action queue."
        whyLocked="Actions is a Team feature because it coordinates shared execution."
        bullets={['Shared action queue', 'Operational routing', 'Team visibility']}
        primaryCtaHref="/pricing?target=team"
        primaryCtaLabel="Upgrade to Team"
      />
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Actions' })).toBeInTheDocument()
    expect(screen.getByText('Locked on Starter')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Upgrade to Team' })).toHaveAttribute('href', '/pricing?target=team')
  })
})

