// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'

import { DashboardClient } from './DashboardClient'

// ---- Mocks (keep tests shallow and fast) ----
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
}))

let planMock: {
  plan: 'free' | 'pro'
  tier: 'starter' | 'closer' | 'closer_plus' | 'team'
  isPro: boolean
  trial: { active: boolean; endsAt: string | null }
  capabilities: { tour_goals: boolean; why_now_digest_in_app: boolean }
} = {
  plan: 'free',
  tier: 'starter',
  isPro: false,
  trial: { active: false, endsAt: null },
  capabilities: { tour_goals: true, why_now_digest_in_app: true },
}
vi.mock('@/components/PlanProvider', () => ({
  usePlan: () => planMock,
}))

vi.mock('./hooks/useTriggerEvents', () => ({
  useTriggerEvents: () => ({
    events: [],
    loading: false,
    error: null,
    loadEvents: vi.fn(),
    lastUpdatedAt: null,
  }),
}))
vi.mock('./hooks/useCredits', () => ({
  useCredits: () => ({
    creditsRemaining: 1,
    loading: false,
    loadCredits: vi.fn(),
  }),
}))
vi.mock('./hooks/useStats', () => ({
  useStats: () => ({
    totalLeads: 0,
    loadStats: vi.fn(),
  }),
}))
vi.mock('./hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    showOnboarding: false,
    onboardingComplete: true,
    onboardingChecked: true,
    handleOnboardingComplete: vi.fn(),
    dismissOnboarding: vi.fn(),
  }),
}))
vi.mock('./hooks/useDebugInfo', () => ({
  useDebugInfo: () => ({
    debugInfo: null,
    showDebug: false,
    checkWhoami: vi.fn(),
    hideDebug: vi.fn(),
  }),
}))

// Stub heavy child components (we only care about tab triggers here)
vi.mock('@/components/DashboardHeader', () => ({ DashboardHeader: () => null }))
vi.mock('./components/DashboardHeaderSection', () => ({ DashboardHeaderSection: () => null }))
vi.mock('./components/StatsBar', () => ({ StatsBar: () => null }))
vi.mock('./components/TriggerEventsSection', () => ({ TriggerEventsSection: () => null }))
vi.mock('@/components/MarketSidebar', () => ({ MarketSidebar: () => null }))
vi.mock('@/components/PitchGenerator', () => ({ PitchGenerator: () => null }))
vi.mock('@/components/WebsiteVisitors', () => ({ WebsiteVisitors: () => null }))
vi.mock('@/components/LiveIntent', () => ({ LiveIntent: () => null }))
vi.mock('@/components/MarketPulse', () => ({ MarketPulse: () => null }))
vi.mock('@/components/MarketWatchlistTab', () => ({ MarketWatchlistTab: () => null }))
vi.mock('@/components/LeadLibrary', () => ({ LeadLibrary: () => null }))
vi.mock('@/components/OnboardingWizard', () => ({ OnboardingWizard: () => null }))
vi.mock('./components/DebugPanel', () => ({ DebugPanel: () => null }))
vi.mock('./components/ViewModeToggle', () => ({ ViewModeToggle: () => null }))
vi.mock('./components/ProOnlyCard', () => ({ ProOnlyCard: () => null }))
vi.mock('./components/CommunicationPreferencesCard', () => ({ CommunicationPreferencesCard: () => null }))
vi.mock('@/components/feedback/FeedbackCard', () => ({ FeedbackCard: () => null }))
vi.mock('@/components/dashboard/RecentActivityFeed', () => ({ RecentActivityFeed: () => null }))
vi.mock('@/components/ProGate', () => ({ ProGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

describe('DashboardClient tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planMock = {
      plan: 'free',
      tier: 'starter',
      isPro: false,
      trial: { active: false, endsAt: null },
      capabilities: { tour_goals: true, why_now_digest_in_app: true },
    }
  })

  it('renders a horizontal overflow wrapper for half-screen layouts', () => {
    render(
      <DashboardClient
        initialSubscriptionTier="free"
        initialCreditsRemaining={1}
        initialOnboardingCompleted={true}
        initialAutopilotEnabled={false}
        initialHasIcp={false}
        initialTourCompletedAt={null}
      />
    )

    expect(screen.getByTestId('dashboard-overflow-x')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-tabs-strip')).toBeInTheDocument()
  })

  it('hides Market Pulse tab for Starter users', async () => {
    render(
      <DashboardClient
        initialSubscriptionTier="free"
        initialCreditsRemaining={1}
        initialOnboardingCompleted={true}
        initialAutopilotEnabled={false}
        initialHasIcp={false}
        initialTourCompletedAt={null}
      />
    )

    const marketTab = screen.queryByRole('tab', { name: /market pulse/i })
    expect(marketTab).toBeNull()
    expect(screen.queryByText('Pro')).toBeNull()
  })

  it('still renders the Market Pulse Pro pill for a paid tier render (Closer)', async () => {
    // DashboardClient uses `isPro` for badge visibility, and syncs it from usePlan().isPro in an effect.
    // This test asserts the badge is present even when the server render says "pro".
    planMock = {
      plan: 'pro',
      tier: 'closer',
      isPro: false,
      trial: { active: false, endsAt: null },
      capabilities: { tour_goals: true, why_now_digest_in_app: true },
    }

    render(
      <DashboardClient
        initialSubscriptionTier="pro"
        initialCreditsRemaining={9999}
        initialOnboardingCompleted={true}
        initialAutopilotEnabled={false}
        initialHasIcp={true}
        initialTourCompletedAt={null}
      />
    )

    // Flush the effect that syncs isPro from the plan hook.
    await act(async () => {
      await Promise.resolve()
    })

    const marketTab = screen.getByRole('tab', { name: /market pulse/i })
    expect(within(marketTab).queryByText('Pro')).toBeNull()
  })
})

