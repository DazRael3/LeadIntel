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

  it('renders locked tier based on effective tier', async () => {
    const { TeamUpgradeGate } = await import('./TeamUpgradeGate')
    render(<TeamUpgradeGate heading="Command Center" currentTier="closer_plus" />)
    expect(screen.getByText('Locked on Closer+')).toBeInTheDocument()
  })

  it('renders session proof when email provided', async () => {
    const { TeamUpgradeGate } = await import('./TeamUpgradeGate')
    render(<TeamUpgradeGate heading="Templates" currentTier="starter" sessionEmail="qa-team@dazrael.com" />)
    expect(screen.getByText(/signed in as/i)).toBeInTheDocument()
    expect(screen.getByText(/qa-team@dazrael\.com/i)).toBeInTheDocument()
  })
})

