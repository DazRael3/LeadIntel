// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { DashboardHeaderSection } from './DashboardHeaderSection'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../hooks/useStripePortal', () => ({
  useStripePortal: () => ({ openPortal: vi.fn(async () => {}) }),
}))

const planMock: { tier: 'starter' | 'closer'; isHouseCloserOverride?: boolean } = { tier: 'starter', isHouseCloserOverride: false }
vi.mock('@/components/PlanProvider', () => ({
  usePlan: () => planMock,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}))

vi.mock('@/lib/supabase/safe-auth', () => ({
  getUserSafe: vi.fn(async () => ({ email: 'alice@example.com', user_metadata: { name: 'Alice' } })),
}))

describe('DashboardHeaderSection', () => {
  it('starter shows Upgrade to Closer CTA', () => {
    planMock.tier = 'starter'
    planMock.isHouseCloserOverride = false
    render(<DashboardHeaderSection isPro={false} creditsRemaining={1} />)
    expect(screen.getByRole('button', { name: /upgrade to closer/i })).toBeTruthy()
    expect(screen.getByText(/starter/i)).toBeTruthy()
    expect(screen.queryByText(/house closer/i)).toBeNull()
    expect(screen.getByRole('button', { name: /toggle color theme/i })).toBeTruthy()
  })

  it('closer hides Upgrade to Closer CTA', () => {
    planMock.tier = 'closer'
    planMock.isHouseCloserOverride = false
    render(<DashboardHeaderSection isPro={true} creditsRemaining={9999} />)
    expect(screen.queryByRole('button', { name: /upgrade to closer/i })).toBeNull()
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeTruthy()
    expect(screen.getByText(/closer/i)).toBeTruthy()
    expect(screen.queryByText(/house closer/i)).toBeNull()
    expect(screen.getByRole('button', { name: /toggle color theme/i })).toBeTruthy()
  })

  it('house closer shows House Closer badge', () => {
    planMock.tier = 'closer'
    planMock.isHouseCloserOverride = true
    render(<DashboardHeaderSection isPro={true} creditsRemaining={9999} />)
    expect(screen.getByText(/house closer/i)).toBeTruthy()
  })
})

