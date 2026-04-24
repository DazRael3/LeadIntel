// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BillingSettingsClient } from './BillingSettingsClient'

const openPortalMock = vi.fn(async () => {})

vi.mock('@/app/dashboard/hooks/useStripePortal', () => ({
  useStripePortal: () => ({ openPortal: openPortalMock }),
}))

describe('BillingSettingsClient', () => {
  it('renders upgrade CTA toward Pro for free plan', () => {
    render(
      <BillingSettingsClient
        email="user@example.com"
        tier="starter"
        plan={{
          plan: 'free',
          label: 'Free',
          leadGenerationLimit: 3,
          aiPitchLimit: 10,
          exportsEnabled: false,
          campaignAutomationEnabled: false,
        }}
      />
    )

    const cta = screen.getByRole('link', { name: 'Upgrade to Pro' })
    expect(cta).toHaveAttribute('href', '/pricing?target=closer')
  })

  it('renders upgrade CTA toward Agency for pro plan', () => {
    render(
      <BillingSettingsClient
        email="user@example.com"
        tier="closer"
        plan={{
          plan: 'pro',
          label: 'Pro',
          leadGenerationLimit: 250,
          aiPitchLimit: 300,
          exportsEnabled: true,
          campaignAutomationEnabled: true,
        }}
      />
    )

    const cta = screen.getByRole('link', { name: 'Upgrade to Agency' })
    expect(cta).toHaveAttribute('href', '/pricing?target=team')
  })

  it('opens Stripe portal from billing button when clicked', async () => {
    render(
      <BillingSettingsClient
        email="user@example.com"
        tier="closer"
        plan={{
          plan: 'pro',
          label: 'Pro',
          leadGenerationLimit: 250,
          aiPitchLimit: 300,
          exportsEnabled: true,
          campaignAutomationEnabled: true,
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open Stripe billing portal' }))
    await waitFor(() => {
      expect(openPortalMock).toHaveBeenCalledTimes(1)
    })
  })
})
