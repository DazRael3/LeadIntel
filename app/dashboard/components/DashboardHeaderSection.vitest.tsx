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

const planMock: {
  plan: 'free' | 'pro'
  tier: 'starter' | 'closer' | 'closer_plus' | 'team'
  planId: string | null
  isHouseCloserOverride?: boolean
  qaDebugEligible?: boolean
  debug?: { rawSubscriptionTier?: string | null } | null
  buildInfo?: {
    repoSlug: string | null
    repoOwner: string | null
    branch: string | null
    commitSha: string | null
  } | null
} = {
  plan: 'free',
  tier: 'starter',
  planId: null,
  isHouseCloserOverride: false,
  qaDebugEligible: false,
  debug: null,
  buildInfo: null,
}
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
    planMock.plan = 'free'
    planMock.planId = null
    planMock.isHouseCloserOverride = false
    planMock.buildInfo = null
    render(<DashboardHeaderSection creditsRemaining={1} />)
    expect(screen.getByRole('button', { name: /upgrade to closer/i })).toBeTruthy()
    expect(screen.getByText(/starter/i)).toBeTruthy()
    expect(screen.queryByText(/house closer/i)).toBeNull()
    expect(screen.queryByTestId('build-debug-panel')).toBeNull()
    expect(screen.getByRole('button', { name: /upgrade to closer/i })).toBeTruthy()
  })

  it('closer hides Upgrade to Closer CTA', () => {
    planMock.tier = 'closer'
    planMock.plan = 'pro'
    planMock.planId = 'pro'
    planMock.isHouseCloserOverride = false
    planMock.buildInfo = { repoOwner: 'DazRael3', repoSlug: 'LeadIntel', branch: 'main', commitSha: 'abcdef123456' }
    render(<DashboardHeaderSection creditsRemaining={9999} />)
    expect(screen.queryByRole('button', { name: /upgrade to closer/i })).toBeNull()
    expect(screen.getByRole('button', { name: /upgrade to closer\\+/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeTruthy()
    expect(screen.getByText(/closer/i)).toBeTruthy()
    expect(screen.queryByText(/house closer/i)).toBeNull()
    expect(screen.queryByTestId('build-debug-panel')).toBeNull()
  })

  it('closer_plus shows Upgrade to Team CTA', () => {
    planMock.tier = 'closer_plus'
    planMock.plan = 'pro'
    planMock.planId = 'closer_plus'
    planMock.isHouseCloserOverride = false
    planMock.buildInfo = null
    render(<DashboardHeaderSection creditsRemaining={9999} />)
    expect(screen.getByRole('button', { name: /upgrade to team/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeTruthy()
    expect(screen.getByText(/closer\\+/i)).toBeTruthy()
  })

  it('team shows Manage billing and no upgrade CTAs', () => {
    planMock.tier = 'team'
    planMock.plan = 'pro'
    planMock.planId = 'team'
    planMock.isHouseCloserOverride = false
    planMock.qaDebugEligible = false
    planMock.debug = null
    planMock.buildInfo = null
    render(<DashboardHeaderSection creditsRemaining={9999} />)
    expect(screen.queryByRole('button', { name: /upgrade to closer\\+/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /upgrade to team/i })).toBeNull()
    expect(screen.getByRole('button', { name: /manage billing/i })).toBeTruthy()
    expect(screen.getByText(/team/i)).toBeTruthy()
  })

  it('shows tier proof chip when qaDebugEligible', () => {
    planMock.tier = 'team'
    planMock.plan = 'pro'
    planMock.planId = 'team'
    planMock.isHouseCloserOverride = false
    planMock.qaDebugEligible = true
    planMock.debug = { rawSubscriptionTier: 'team' }
    planMock.buildInfo = null
    render(<DashboardHeaderSection creditsRemaining={9999} />)
    expect(screen.getByTestId('tier-proof-chip')).toBeTruthy()
    expect(screen.getByText(/tier proof/i)).toBeTruthy()
    expect(screen.getByText(/effective=team/i)).toBeTruthy()
    expect(screen.getByText(/raw=team/i)).toBeTruthy()
  })

  it('house closer shows House Closer badge', () => {
    planMock.tier = 'closer'
    planMock.plan = 'pro'
    planMock.planId = 'pro'
    planMock.isHouseCloserOverride = true
    planMock.buildInfo = { repoOwner: 'DazRael3', repoSlug: 'LeadIntel', branch: 'main', commitSha: 'abcdef123456' }
    render(<DashboardHeaderSection creditsRemaining={9999} />)
    expect(screen.getByText(/house closer/i)).toBeTruthy()
    expect(screen.getByTestId('build-debug-panel')).toBeTruthy()
    expect(screen.getByText(/build debug \(house closer only\)/i)).toBeTruthy()
    expect(screen.getByText(/dazrael3\/leadintel/i)).toBeTruthy()
    expect(screen.getByText(/abcdef1/i)).toBeTruthy()
  })
})

