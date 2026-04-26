// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { DashboardClient } from './DashboardClient'

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

vi.mock('./hooks/useDebugInfo', () => ({
  useDebugInfo: () => ({
    debugInfo: null,
    showDebug: false,
    checkWhoami: vi.fn(),
    hideDebug: vi.fn(),
  }),
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
vi.mock('./components/DebugPanel', () => ({ DebugPanel: () => null }))
vi.mock('./components/ViewModeToggle', () => ({ ViewModeToggle: () => null }))
vi.mock('./components/ProOnlyCard', () => ({ ProOnlyCard: () => null }))
vi.mock('./components/CommunicationPreferencesCard', () => ({ CommunicationPreferencesCard: () => null }))
vi.mock('@/components/feedback/FeedbackCard', () => ({ FeedbackCard: () => null }))
vi.mock('@/components/tour/InAppTourProvider', () => ({ InAppTourProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/components/dashboard/ActivationChecklist', () => ({ ActivationChecklist: () => null }))
vi.mock('@/components/dashboard/GettingStartedRail', () => ({ GettingStartedRail: () => null }))
vi.mock('@/components/dashboard/RecentActivityFeed', () => ({ RecentActivityFeed: () => null }))
vi.mock('@/components/dashboard/ValueMomentsCard', () => ({ ValueMomentsCard: () => null }))
vi.mock('@/components/dashboard/UpgradeReasonsCard', () => ({ UpgradeReasonsCard: () => null }))
vi.mock('@/components/dashboard/ActionQueueCard', () => ({ ActionQueueCard: () => null }))
vi.mock('@/components/dashboard/DailyRetentionCard', () => ({ DailyRetentionCard: () => null }))
vi.mock('@/components/mobile/MobileShortlistView', () => ({ MobileShortlistView: () => null }))
vi.mock('@/components/sample/SampleModeCard', () => ({ SampleModeCard: () => null }))
vi.mock('@/components/tour/TourGoalsCard', () => ({ TourGoalsCard: () => null }))
vi.mock('@/components/digest/InAppWhyNowDigestCard', () => ({ InAppWhyNowDigestCard: () => null }))
vi.mock('./components/QuickTourActionsCard', () => ({ QuickTourActionsCard: () => null }))
vi.mock('./components/ScoreExplainerCard', () => ({ ScoreExplainerCard: () => null }))
vi.mock('./components/ActivationGoalCard', () => ({ ActivationGoalCard: () => null }))

function renderDashboardClient(): void {
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
}

describe('DashboardClient lead activity fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planMock = {
      plan: 'free',
      tier: 'starter',
      isPro: false,
      trial: { active: false, endsAt: null },
      capabilities: { tour_goals: true, why_now_digest_in_app: true },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            summary: { newLeadsSinceLastVisit: 0, campaignsAwaitingAction: 0 },
            meta: {
              state: 'empty',
              fallback: false,
              reason: 'no_recent_activity',
              hasWorkspace: true,
              generatedAt: new Date().toISOString(),
            },
          },
        }),
      }))
    )
  })

  it('renders user-friendly empty state when lead activity is empty', async () => {
    renderDashboardClient()

    await waitFor(() => {
      expect(screen.getByText('No recent lead activity yet.')).toBeInTheDocument()
    })
    expect(screen.getByText(/You have 0 new leads/)).toBeInTheDocument()
  })

  it('renders fallback state when lead activity API is unavailable', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ ok: false, error: { code: 'SERVICE_UNAVAILABLE' } }),
    } as Response)

    renderDashboardClient()

    await waitFor(() => {
      expect(screen.getByText('No recent lead activity yet.')).toBeInTheDocument()
    })
    expect(screen.getByText(/Campaigns awaiting action: 0/)).toBeInTheDocument()
  })
})
