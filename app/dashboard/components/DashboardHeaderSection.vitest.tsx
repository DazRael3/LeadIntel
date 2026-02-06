// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { DashboardHeaderSection } from './DashboardHeaderSection'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../hooks/useStripePortal', () => ({
  useStripePortal: () => ({ openPortal: vi.fn() }),
}))

const planMock: { tier: 'starter' | 'closer' | 'team' } = { tier: 'starter' }
vi.mock('@/components/PlanProvider', () => ({
  usePlan: () => planMock,
}))

describe('DashboardHeaderSection', () => {
  it('starter shows Upgrade to Closer CTA', () => {
    planMock.tier = 'starter'
    render(<DashboardHeaderSection isPro={false} creditsRemaining={1} />)
    expect(screen.getByRole('button', { name: /upgrade to closer/i })).toBeTruthy()
  })

  it('closer hides Upgrade to Closer CTA', () => {
    planMock.tier = 'closer'
    render(<DashboardHeaderSection isPro={true} creditsRemaining={9999} />)
    expect(screen.queryByRole('button', { name: /upgrade to closer/i })).toBeNull()
  })

  it('team hides Upgrade to Closer CTA', () => {
    planMock.tier = 'team'
    render(<DashboardHeaderSection isPro={true} creditsRemaining={9999} />)
    expect(screen.queryByRole('button', { name: /upgrade to closer/i })).toBeNull()
  })
})

