'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity, DollarSign, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { LeadLibrary } from '@/components/LeadLibrary'
import { WebsiteVisitors } from '@/components/WebsiteVisitors'
import { LiveIntent } from '@/components/LiveIntent'
import { MarketSidebar } from '@/components/MarketSidebar'
import { DashboardHeader } from '@/components/DashboardHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PitchGenerator } from '@/components/PitchGenerator'
import { MarketPulse } from '@/components/MarketPulse'
import { MarketWatchlistTab } from '@/components/MarketWatchlistTab'
import { usePlan } from '@/components/PlanProvider'
import { getEntitlements } from '@/lib/billing/entitlements'
import { tierAtLeast } from '@/lib/billing/tier'
import { getDashboardTabs, getModulePolicy, type DashboardTabKey } from '@/lib/dashboard/policy'
import { useTriggerEvents } from './hooks/useTriggerEvents'
import { useCredits } from './hooks/useCredits'
import { useStats } from './hooks/useStats'
import { useDebugInfo } from './hooks/useDebugInfo'
import { DashboardHeaderSection } from './components/DashboardHeaderSection'
import { StatsBar } from './components/StatsBar'
import { TriggerEventsSection } from './components/TriggerEventsSection'
import { DebugPanel } from './components/DebugPanel'
import { ViewModeToggle } from './components/ViewModeToggle'
import { ProOnlyCard } from './components/ProOnlyCard'
import { CommunicationPreferencesCard } from './components/CommunicationPreferencesCard'
import { ActivationGoalCard } from './components/ActivationGoalCard'
import { InAppTourProvider } from '@/components/tour/InAppTourProvider'
import { QuickTourActionsCard } from './components/QuickTourActionsCard'
import { ScoreExplainerCard } from './components/ScoreExplainerCard'
import { ActivationChecklist } from '@/components/dashboard/ActivationChecklist'
import { GettingStartedRail } from '@/components/dashboard/GettingStartedRail'
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed'
import { ValueMomentsCard } from '@/components/dashboard/ValueMomentsCard'
import { UpgradeReasonsCard } from '@/components/dashboard/UpgradeReasonsCard'
import { ActionQueueCard } from '@/components/dashboard/ActionQueueCard'
import { DailyRetentionCard } from '@/components/dashboard/DailyRetentionCard'
import { MobileShortlistView } from '@/components/mobile/MobileShortlistView'
import { FeedbackCard } from '@/components/feedback/FeedbackCard'
import { SampleModeCard } from '@/components/sample/SampleModeCard'
import { TourGoalsCard } from '@/components/tour/TourGoalsCard'
import { InAppWhyNowDigestCard } from '@/components/digest/InAppWhyNowDigestCard'

type LeadActivitySummary = {
  newLeadsSinceLastVisit: number
  campaignsAwaitingAction: number
}

type LeadActivityMeta = {
  state: string
  fallback: boolean
  reason: string
  hasWorkspace: boolean
  generatedAt: string
}

type LeadActivityApiEnvelope =
  | {
      ok: true
      data: {
        summary?: LeadActivitySummary
        meta?: LeadActivityMeta
      }
    }
  | {
      ok: false
      error?: {
        code?: string
      }
    }

const EMPTY_LEAD_ACTIVITY_SUMMARY: LeadActivitySummary = {
  newLeadsSinceLastVisit: 0,
  campaignsAwaitingAction: 0,
}

function isValidLeadActivitySummary(value: unknown): value is LeadActivitySummary {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.newLeadsSinceLastVisit === 'number' &&
    Number.isFinite(record.newLeadsSinceLastVisit) &&
    typeof record.campaignsAwaitingAction === 'number' &&
    Number.isFinite(record.campaignsAwaitingAction)
  )
}

interface DashboardClientProps {
  initialSubscriptionTier: 'free' | 'pro'
  initialCreditsRemaining: number
  initialOnboardingCompleted: boolean
  initialAutopilotEnabled: boolean
  initialCompanyInput?: string
  initialHasIcp: boolean
  initialTourCompletedAt: string | null
  initialFocus?: 'pitch' | null
}

export function DashboardClient({ 
  initialSubscriptionTier, 
  initialCreditsRemaining, 
  initialOnboardingCompleted,
  initialAutopilotEnabled,
  initialCompanyInput,
  initialHasIcp,
  initialTourCompletedAt,
  initialFocus,
}: DashboardClientProps) {
  const [isPro, setIsPro] = useState(initialSubscriptionTier === 'pro')
  const [viewMode, setViewMode] = useState<'startup' | 'enterprise'>('startup')
  const [autopilotEnabled, setAutopilotEnabled] = useState<boolean>(initialAutopilotEnabled)
  const [autopilotSaving, setAutopilotSaving] = useState<boolean>(false)
  const [activeCompanyInput, setActiveCompanyInput] = useState<string | null>(null)
  const [activeCompanyDomain, setActiveCompanyDomain] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DashboardTabKey>('command')
  const [leadActivitySummary, setLeadActivitySummary] = useState<LeadActivitySummary>(EMPTY_LEAD_ACTIVITY_SUMMARY)
  const [leadActivityStatusMessage, setLeadActivityStatusMessage] = useState<string>('No recent lead activity yet.')
  const [leadActivityLoaded, setLeadActivityLoaded] = useState<boolean>(false)
  const router = useRouter()
  const { plan, tier, isPro: planIsPro, trial } = usePlan()
  // Debug UI should never render in production even if misconfigured env vars are present.
  const debugEnabled = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENABLE_DEBUG_UI === 'true'
  const autopilotUiEnabled = process.env.NEXT_PUBLIC_ENABLE_AUTOPILOT_UI === 'true'
  const entitlements = useMemo(() => getEntitlements({ plan, trial }), [plan, trial])
  const isStarter = tier === 'starter'
  const tabs = useMemo(() => getDashboardTabs({ tier, entitlements }), [tier, entitlements])

  // Data fetching hooks
  const { events, loading: eventsLoading, error: eventsError, loadEvents, lastUpdatedAt } = useTriggerEvents()
  const { creditsRemaining, loading: creditsLoading, loadCredits } = useCredits(initialCreditsRemaining, initialSubscriptionTier === 'pro')
  const { totalLeads, loadStats } = useStats()
  const { debugInfo, showDebug, checkWhoami, hideDebug } = useDebugInfo()

  // Sync isPro state with plan hook
  useEffect(() => {
    setIsPro(planIsPro)
    if (planIsPro) {
      loadCredits(true)
    }
  }, [planIsPro, loadCredits])

  // Initial data load: keep this cheap and entitlement-aware.
  useEffect(() => {
    // Credits are derived server-side as well; the client refresh stays read-only.
    void loadCredits(planIsPro)
    // Only load stats when the command surface is active to prevent background request spam.
    if (activeTab === 'command') {
      void loadStats()
    }
  }, [loadCredits, loadStats, planIsPro, activeTab])

  useEffect(() => {
    if (initialFocus === 'pitch') {
      const el = document.querySelector('[data-tour="tour-generate-pitch"]') as HTMLElement | null
      if (el) el.scrollIntoView({ block: 'center' })
    }
  }, [initialFocus])

  const triggerFilter = useMemo(() => {
    if (activeCompanyDomain) return { companyDomain: activeCompanyDomain }
    if (activeCompanyInput) return { companyName: activeCompanyInput }
    return undefined
  }, [activeCompanyDomain, activeCompanyInput])

  // Refresh Trigger Events when the active company context changes (debounced).
  useEffect(() => {
    if (activeTab !== 'command') return
    const t = setTimeout(() => {
      void loadEvents(triggerFilter)
    }, 250)
    return () => clearTimeout(t)
  }, [loadEvents, triggerFilter, activeTab])

  const onCompanyContextChange = useCallback((args: { companyInput: string; companyDomain: string | null }) => {
    setActiveCompanyInput(args.companyInput)
    setActiveCompanyDomain(args.companyDomain)
  }, [])

  const loading = creditsLoading

  const autoStartEligible = (!initialHasIcp || totalLeads === 0) && !initialOnboardingCompleted

  const actionQueuePolicy = useMemo(() => getModulePolicy({ tier, module: 'action_queue' }), [tier])
  const marketSidebarPolicy = useMemo(() => getModulePolicy({ tier, module: 'market_sidebar' }), [tier])

  useEffect(() => {
    if (activeTab !== 'command') return
    let cancelled = false
    const loadLeadActivitySummary = async () => {
      try {
        const response = await fetch('/api/lead-activity', { cache: 'no-store' })
        const payload = (await response.json().catch(() => null)) as LeadActivityApiEnvelope | null
        if (cancelled) return
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setLeadActivityStatusMessage('Sign in again to load recent activity.')
          } else {
            setLeadActivityStatusMessage('No recent lead activity yet.')
          }
          setLeadActivitySummary(EMPTY_LEAD_ACTIVITY_SUMMARY)
          setLeadActivityLoaded(true)
          return
        }
        if (!payload || payload.ok !== true) {
          setLeadActivityStatusMessage('No recent lead activity yet.')
          setLeadActivitySummary(EMPTY_LEAD_ACTIVITY_SUMMARY)
          setLeadActivityLoaded(true)
          return
        }

        const summary = isValidLeadActivitySummary(payload.data?.summary)
          ? payload.data.summary
          : EMPTY_LEAD_ACTIVITY_SUMMARY
        setLeadActivitySummary(summary)

        const hasActivity = summary.newLeadsSinceLastVisit > 0 || summary.campaignsAwaitingAction > 0
        if (hasActivity) {
          setLeadActivityStatusMessage('Recent activity updated.')
        } else {
          const state = payload.data?.meta?.state ?? ''
          if (state === 'forbidden') {
            setLeadActivityStatusMessage('Access to activity is limited right now.')
          } else if (state === 'workspace_missing' || state === 'workspace_unavailable') {
            setLeadActivityStatusMessage('No recent lead activity yet.')
          } else {
            setLeadActivityStatusMessage('No recent lead activity yet.')
          }
        }
        setLeadActivityLoaded(true)
      } catch {
        if (!cancelled) {
          setLeadActivitySummary(EMPTY_LEAD_ACTIVITY_SUMMARY)
          setLeadActivityStatusMessage('No recent lead activity yet.')
          setLeadActivityLoaded(true)
        }
      }
    }
    void loadLeadActivitySummary()
    return () => {
      cancelled = true
    }
  }, [activeTab])

  return (
    <div className="min-h-screen bg-background terminal-grid overflow-x-clip" data-testid="dashboard-root">
      <InAppTourProvider autoStartEligible={autoStartEligible} serverTourCompletedAt={initialTourCompletedAt}>
        <DashboardHeader />

      {/* Header */}
      <DashboardHeaderSection creditsRemaining={creditsRemaining} />

      {/* Debug Panel - Guarded behind NEXT_PUBLIC_ENABLE_DEBUG_UI */}
      {debugEnabled && showDebug && debugInfo && (
        <DebugPanel debugInfo={debugInfo} onClose={hideDebug} />
      )}

      {/* Stats Bar */}
      <StatsBar 
        totalLeads={totalLeads} 
        eventsCount={events.length} 
        debugEnabled={debugEnabled}
        onDebugClick={checkWhoami}
      />

      {/* Main Content */}
      <div className="w-full min-w-0 overflow-x-hidden" data-testid="dashboard-overflow-x">
        <main className="container mx-auto min-w-0 px-4 sm:px-6 py-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as DashboardTabKey)}
          className={isStarter ? 'space-y-5' : 'space-y-6'}
        >
          <div className="w-full max-w-full overflow-x-auto pb-1" data-testid="dashboard-tabs-strip">
            <TabsList className="flex h-auto w-max min-w-max max-w-full flex-nowrap items-center justify-start gap-1 border border-cyan-500/20 bg-background/50 p-1 sm:w-full sm:min-w-0 sm:flex-wrap">
              {tabs
                .filter((t) => t.visible)
                .map((t) => (
                  <TabsTrigger
                    key={t.key}
                    value={t.key}
                    className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400"
                  >
                    {t.label}
                    {t.badge ? (
                      <Badge variant="outline" className="ml-2 border-purple-500/30 text-purple-400 bg-purple-500/10 text-xs h-4 px-1">
                        {t.badge.label}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                ))}
            </TabsList>
          </div>

          {activeTab === 'command' ? (
            <TabsContent value="command" className={isStarter ? 'space-y-5' : 'space-y-6'}>
            {tierAtLeast(tier, 'team') ? (
              <MobileShortlistView />
            ) : (
              <div className="md:hidden">
                <ProOnlyCard
                  title="Daily shortlist is Team-only"
                  description="Upgrade to Team to unlock the workflow shortlist, queue + approvals triage, and team operations."
                  icon="lock"
                  iconColor="purple"
                  upgradeTarget="team"
                />
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Primary column */}
              <div className="lg:col-span-3 space-y-6">
                {/* Primary workflow: next step + generate */}
                {isStarter ? (
                  <div className="space-y-6">
                    <PitchGenerator
                      initialUrl={initialCompanyInput}
                      onCompanyContextChange={onCompanyContextChange}
                      navigateToPitchOnGenerate
                    />
                    <GettingStartedRail />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <GettingStartedRail />
                    <PitchGenerator
                      initialUrl={initialCompanyInput}
                      onCompanyContextChange={onCompanyContextChange}
                      navigateToPitchOnGenerate
                    />
                  </div>
                )}

                {/* Today / progress */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ActivationChecklist />
                  <RecentActivityFeed />
                </div>

                <DailyRetentionCard
                  totalLeads={totalLeads}
                  nicheLabel={initialHasIcp ? 'your ICP' : 'your recent behavior'}
                />

                <Card className="border-cyan-500/20 bg-card/50">
                  <CardContent className="py-4">
                    {leadActivityLoaded ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">
                            You have {leadActivitySummary.newLeadsSinceLastVisit} new leads
                          </Badge>
                          <Badge variant="outline">
                            Campaigns awaiting action: {leadActivitySummary.campaignsAwaitingAction}
                          </Badge>
                        </div>
                        {leadActivitySummary.newLeadsSinceLastVisit === 0 &&
                        leadActivitySummary.campaignsAwaitingAction === 0 ? (
                          <p className="text-xs text-muted-foreground">{leadActivityStatusMessage}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Loading recent activity...</p>
                    )}
                  </CardContent>
                </Card>

                {/* Secondary guidance */}
                {isStarter ? (
                  <>
                    <ScoreExplainerCard />
                    <TourGoalsCard compact />
                    <SampleModeCard />
                    <UpgradeReasonsCard />
                  </>
                ) : (
                  <>
                    <ValueMomentsCard />
                    <ScoreExplainerCard />
                    <QuickTourActionsCard />
                    <InAppWhyNowDigestCard />
                    <ActivationGoalCard totalLeads={totalLeads} />
                    <UpgradeReasonsCard />
                  </>
                )}

                {isStarter ? (
                  <Card className="border-cyan-500/20 bg-card/50">
                    <CardContent className="py-6 space-y-2 text-sm text-muted-foreground">
                      <div className="text-sm font-semibold text-foreground">What’s next on Starter</div>
                      <div>
                        You can generate preview pitches and reports, track a small set of accounts, and learn the workflow. Advanced signals and team operations unlock on paid tiers.
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button asChild variant="outline" className="w-full sm:w-auto min-h-10 neon-border hover:glow-effect">
                          <Link href="/pricing?target=closer">See what Closer unlocks</Link>
                        </Button>
                        <Button asChild variant="outline" className="w-full sm:w-auto min-h-10">
                          <Link href="/trust">Verify trust posture</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {isStarter ? (
                  <FeedbackCard
                    surface="dashboard"
                    title="Quick feedback"
                    prompt="Anything confusing or blocking you right now?"
                    className="border-cyan-500/20 bg-card/50"
                  />
                ) : null}
              </div>

              {/* Secondary column */}
              <div className="lg:col-span-1 space-y-6">
                <TriggerEventsSection
                  events={events}
                  loading={eventsLoading}
                  error={eventsError}
                  onRefresh={() => loadEvents(triggerFilter)}
                  companyDomain={activeCompanyDomain}
                  companyLabel={activeCompanyInput}
                  lastUpdatedAt={lastUpdatedAt}
                  debugEnabled={debugEnabled}
                />

                {actionQueuePolicy.canMount ? (
                  <ActionQueueCard />
                ) : actionQueuePolicy.renderAs === 'locked' ? (
                  <ProOnlyCard
                    title="Action queue is Team-only"
                    description="Upgrade to Team to review and deliver queued handoffs from your workspace action layer."
                    icon="lock"
                    iconColor="purple"
                    upgradeTarget="team"
                  />
                ) : null}

                {marketSidebarPolicy.canMount ? (
                  <MarketSidebar />
                ) : marketSidebarPolicy.renderAs === 'locked' ? (
                  <ProOnlyCard
                    title="Markets and watchlists are available on Closer"
                    description="Upgrade to Closer to unlock market pulse, watchlists, and alerts."
                    icon="lock"
                    iconColor="purple"
                    upgradeTarget="closer"
                  />
                ) : null}
              </div>
            </div>
          </TabsContent>
          ) : null}

          {activeTab === 'leads' ? (
            <TabsContent value="leads" className="space-y-6">
            {/* View Mode Toggle */}
            <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Main Column */}
              <div className={marketSidebarPolicy.canMount ? 'lg:col-span-3' : 'lg:col-span-4'}>
                {loading ? (
                  <Card className="border-cyan-500/20 bg-card/50">
                    <CardContent className="py-20 text-center">
                      <Activity className="h-16 w-16 mx-auto mb-4 text-cyan-400 animate-pulse" />
                      <p className="text-muted-foreground uppercase tracking-wider">Loading Intelligence...</p>
                    </CardContent>
                  </Card>
                ) : (
                  entitlements.canAccessPitchHistory ? (
                    <LeadLibrary isPro={isPro} creditsRemaining={creditsRemaining} viewMode={viewMode} />
                  ) : (
                    <Card className="border-cyan-500/20 bg-card/50">
                      <CardContent className="py-12 text-center space-y-3">
                        <div className="mx-auto inline-flex items-center justify-center h-12 w-12 rounded-full border border-cyan-500/20 bg-cyan-500/10">
                          <Lock className="h-5 w-5 text-cyan-300" />
                        </div>
                        <div className="text-lg font-semibold">Your work is safely stored</div>
                        <div className="text-sm text-muted-foreground max-w-xl mx-auto">
                          Upgrade to Closer to unlock your Lead Library, saved outputs, and exports—and continue where you left off.
                        </div>
                        <Button
                          size="sm"
                          className="neon-border hover:glow-effect"
                          onClick={() => (window.location.href = '/pricing?target=closer')}
                        >
                          Upgrade to Closer
                        </Button>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>

              {/* Right Sidebar - Markets */}
              {marketSidebarPolicy.canMount ? (
                <div className="lg:col-span-1">
                  <MarketSidebar />
                </div>
              ) : null}
            </div>
          </TabsContent>
          ) : null}

          {activeTab === 'visitors' ? (
            <TabsContent value="visitors" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className={marketSidebarPolicy.canMount ? 'lg:col-span-3' : 'lg:col-span-4'}>
                  {tierAtLeast(tier, 'closer') ? (
                    <WebsiteVisitors />
                  ) : (
                    <ProOnlyCard
                      title="Website visitors are available on Closer"
                      description="Upgrade to Closer to enable visitor tracking and company identification."
                      icon="lock"
                      iconColor="purple"
                      upgradeTarget="closer"
                    />
                  )}
                </div>
                {marketSidebarPolicy.canMount ? (
                  <div className="lg:col-span-1">
                    <MarketSidebar />
                  </div>
                ) : null}
              </div>
            </TabsContent>
          ) : null}

          {activeTab === 'live-intent' ? (
            <TabsContent value="live-intent" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className={marketSidebarPolicy.canMount ? 'lg:col-span-3' : 'lg:col-span-4'}>
                  {tierAtLeast(tier, 'closer') ? (
                    <LiveIntent isPro={isPro} />
                  ) : (
                    <ProOnlyCard
                      title="Live Intent is available on Closer"
                      description="Upgrade to Closer to unlock real-time intent signals and enrichment."
                      icon="lock"
                      iconColor="purple"
                      upgradeTarget="closer"
                    />
                  )}
                </div>
                {marketSidebarPolicy.canMount ? (
                  <div className="lg:col-span-1">
                    <MarketSidebar />
                  </div>
                ) : null}
              </div>
            </TabsContent>
          ) : null}

          {activeTab === 'market' ? (
            <TabsContent value="market" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className={marketSidebarPolicy.canMount ? 'lg:col-span-3' : 'lg:col-span-4'}>
                  {tierAtLeast(tier, 'closer') ? (
                    <MarketPulse />
                  ) : (
                    <ProOnlyCard
                      title="Market Pulse is available on Closer"
                      description="Upgrade to Closer to unlock market pulse and alerts."
                      icon="lock"
                      iconColor="purple"
                      upgradeTarget="closer"
                    />
                  )}
                </div>
                {marketSidebarPolicy.canMount ? (
                  <div className="lg:col-span-1">
                    <MarketSidebar />
                  </div>
                ) : null}
              </div>
            </TabsContent>
          ) : null}

          {activeTab === 'watchlist' ? (
            <TabsContent value="watchlist" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {marketSidebarPolicy.canMount ? (
                  <div className="lg:col-span-1">
                    <MarketSidebar />
                  </div>
                ) : null}
                <div className={marketSidebarPolicy.canMount ? 'lg:col-span-3' : 'lg:col-span-4'}>
                  {tierAtLeast(tier, 'closer') ? (
                    <MarketWatchlistTab />
                  ) : (
                    <ProOnlyCard
                      title="Watchlists are available on Closer"
                      description="Upgrade to Closer to build watchlists and configure alerts."
                      icon="lock"
                      iconColor="purple"
                      upgradeTarget="closer"
                    />
                  )}
                </div>
              </div>
            </TabsContent>
          ) : null}

          {activeTab === 'settings' ? (
            <TabsContent value="settings" className="space-y-6">
            {autopilotUiEnabled ? (
              isPro ? (
                <Card className="border-cyan-500/20 bg-card/50">
                  <CardContent className="py-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold">Autopilot</h3>
                        <p className="text-sm text-muted-foreground">
                          Enable scheduled outreach for your tenant (cron-triggered).
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={autopilotEnabled}
                          disabled={autopilotSaving}
                          onChange={async (e) => {
                            const next = e.target.checked
                            setAutopilotSaving(true)
                            try {
                              const res = await fetch('/api/settings/autopilot', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ enabled: next }),
                              })
                              if (res.ok) {
                                setAutopilotEnabled(next)
                              } else {
                                // Keep UI stable; no secret logging.
                                setAutopilotEnabled((prev) => prev)
                              }
                            } finally {
                              setAutopilotSaving(false)
                            }
                          }}
                        />
                        <span>{autopilotEnabled ? 'Enabled' : 'Disabled'}</span>
                      </label>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <ProOnlyCard
                  title="Autopilot is available on Closer"
                  description="Upgrade to Closer to enable Autopilot outreach."
                  icon="lock"
                  iconColor="purple"
                  upgradeTarget="closer"
                />
              )
            ) : (
              <Card className="border-cyan-500/20 bg-card/50">
                <CardContent className="py-10 text-center text-muted-foreground">
                  Autopilot settings are disabled in this environment.
                </CardContent>
              </Card>
            )}

            <CommunicationPreferencesCard />
          </TabsContent>
          ) : null}
        </Tabs>

        {/* Value Proposition Banner for Free Users */}
        {!isPro && creditsRemaining === 0 && (
          <Card className="mt-6 border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-2">Credits Exhausted</h3>
                  <p className="text-sm text-muted-foreground">
                    You&apos;ve used your Starter preview for today. Upgrade to Closer for unlimited access to saved outputs and advanced surfaces.
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/pricing')}
                  className="neon-border hover:glow-effect bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Upgrade to Closer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        </main>
      </div>
      </InAppTourProvider>
    </div>
  )
}
