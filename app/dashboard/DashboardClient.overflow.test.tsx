// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardClient } from './DashboardClient'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
}))

vi.mock('@/components/PlanProvider', () => ({
  usePlan: () => ({
    plan: 'free',
    tier: 'starter',
    isPro: false,
    trial: { active: false, endsAt: null },
    capabilities: { tour_goals: true, why_now_digest_in_app: true },
  }),
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
  useCredits: () => ({ creditsRemaining: 1, loading: false, loadCredits: vi.fn() }),
}))
vi.mock('./hooks/useStats', () => ({
  useStats: () => ({ totalLeads: 0, loadStats: vi.fn() }),
}))
vi.mock('./hooks/useDebugInfo', () => ({
  useDebugInfo: () => ({ debugInfo: null, showDebug: false, checkWhoami: vi.fn(), hideDebug: vi.fn() }),
}))

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
vi.mock('./components/ViewModeToggle', () => ({ ViewModeToggle: () => null }))
vi.mock('./components/ProOnlyCard', () => ({ ProOnlyCard: () => null }))
vi.mock('./components/CommunicationPreferencesCard', () => ({ CommunicationPreferencesCard: () => null }))
vi.mock('@/components/feedback/FeedbackCard', () => ({ FeedbackCard: () => null }))
vi.mock('@/components/dashboard/RecentActivityFeed', () => ({ RecentActivityFeed: () => null }))
vi.mock('@/components/mobile/MobileShortlistView', () => ({ MobileShortlistView: () => null }))
vi.mock('@/components/tour/InAppTourProvider', () => ({
  InAppTourProvider: ({ children }: { children: import('react').ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/dashboard/ActivationChecklist', () => ({ ActivationChecklist: () => null }))
vi.mock('@/components/dashboard/GettingStartedRail', () => ({ GettingStartedRail: () => null }))
vi.mock('@/components/tour/TourGoalsCard', () => ({ TourGoalsCard: () => null }))
vi.mock('@/components/sample/SampleModeCard', () => ({ SampleModeCard: () => null }))
vi.mock('@/components/dashboard/UpgradeReasonsCard', () => ({ UpgradeReasonsCard: () => null }))

describe('Dashboard overflow guards', () => {
  it('renders dedicated overflow-safe wrappers for tabs', () => {
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

  it('applies root overflow clipping to prevent page-level horizontal scroll', () => {
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

    expect(screen.getByTestId('dashboard-root').className).toContain('overflow-x-clip')
  })
})
