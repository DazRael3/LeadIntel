'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Activity, DollarSign, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { LeadLibrary } from '@/components/LeadLibrary'
import { WebsiteVisitors } from '@/components/WebsiteVisitors'
import { LiveIntent } from '@/components/LiveIntent'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { MarketSidebar } from '@/components/MarketSidebar'
import { DashboardHeader } from '@/components/DashboardHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PitchGenerator } from '@/components/PitchGenerator'
import { MarketPulse } from '@/components/MarketPulse'
import { MarketWatchlistTab } from '@/components/MarketWatchlistTab'
import { usePlan } from '@/components/PlanProvider'
import { getEntitlements } from '@/lib/billing/entitlements'
import { useTriggerEvents } from './hooks/useTriggerEvents'
import { useCredits } from './hooks/useCredits'
import { useStats } from './hooks/useStats'
import { useOnboarding } from './hooks/useOnboarding'
import { useDebugInfo } from './hooks/useDebugInfo'
import { DashboardHeaderSection } from './components/DashboardHeaderSection'
import { StatsBar } from './components/StatsBar'
import { TriggerEventsSection } from './components/TriggerEventsSection'
import { DebugPanel } from './components/DebugPanel'
import { ViewModeToggle } from './components/ViewModeToggle'
import { ProOnlyCard } from './components/ProOnlyCard'
import { CommunicationPreferencesCard } from './components/CommunicationPreferencesCard'
import { ProGate } from '@/components/ProGate'
import { ActivationGoalCard } from './components/ActivationGoalCard'
import { InAppTourProvider } from '@/components/tour/InAppTourProvider'
import { QuickTourActionsCard } from './components/QuickTourActionsCard'
import { ScoreExplainerCard } from './components/ScoreExplainerCard'

interface DashboardClientProps {
  initialSubscriptionTier: 'free' | 'pro'
  initialCreditsRemaining: number
  initialOnboardingCompleted: boolean
  initialAutopilotEnabled: boolean
  initialCompanyInput?: string
  initialHasIcp: boolean
  initialTourCompletedAt: string | null
}

export function DashboardClient({ 
  initialSubscriptionTier, 
  initialCreditsRemaining, 
  initialOnboardingCompleted,
  initialAutopilotEnabled,
  initialCompanyInput,
  initialHasIcp,
  initialTourCompletedAt,
}: DashboardClientProps) {
  const [isPro, setIsPro] = useState(initialSubscriptionTier === 'pro')
  const [viewMode, setViewMode] = useState<'startup' | 'enterprise'>('startup')
  const [autopilotEnabled, setAutopilotEnabled] = useState<boolean>(initialAutopilotEnabled)
  const [autopilotSaving, setAutopilotSaving] = useState<boolean>(false)
  const [activeCompanyInput, setActiveCompanyInput] = useState<string | null>(null)
  const [activeCompanyDomain, setActiveCompanyDomain] = useState<string | null>(null)
  const router = useRouter()
  const { plan, isPro: planIsPro, trial } = usePlan()
  // Debug UI should never render in production even if misconfigured env vars are present.
  const debugEnabled = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENABLE_DEBUG_UI === 'true'
  const autopilotUiEnabled = process.env.NEXT_PUBLIC_ENABLE_AUTOPILOT_UI === 'true'
  const entitlements = useMemo(() => getEntitlements({ plan, trial }), [plan, trial])

  // Data fetching hooks
  const { events, loading: eventsLoading, error: eventsError, loadEvents, lastUpdatedAt } = useTriggerEvents()
  const { creditsRemaining, loading: creditsLoading, loadCredits } = useCredits(initialCreditsRemaining, initialSubscriptionTier === 'pro')
  const { totalLeads, loadStats } = useStats()
  const { showOnboarding, onboardingComplete, onboardingChecked, handleOnboardingComplete, dismissOnboarding } =
    useOnboarding(initialOnboardingCompleted)
  const { debugInfo, showDebug, checkWhoami, hideDebug } = useDebugInfo()
  const [manualOnboardingStep, setManualOnboardingStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [manualOnboardingOpen, setManualOnboardingOpen] = useState(false)

  // Sync isPro state with plan hook
  useEffect(() => {
    setIsPro(planIsPro)
    if (planIsPro) {
      loadCredits(true)
    }
  }, [planIsPro, loadCredits])

  // Initial data load
  useEffect(() => {
    loadCredits(planIsPro)
    loadStats()
  }, [loadCredits, loadStats, loadEvents, planIsPro])

  const triggerFilter = useMemo(() => {
    if (activeCompanyDomain) return { companyDomain: activeCompanyDomain }
    if (activeCompanyInput) return { companyName: activeCompanyInput }
    return undefined
  }, [activeCompanyDomain, activeCompanyInput])

  // Refresh Trigger Events when the active company context changes (debounced).
  useEffect(() => {
    const t = setTimeout(() => {
      void loadEvents(triggerFilter)
    }, 250)
    return () => clearTimeout(t)
  }, [loadEvents, triggerFilter])

  const onCompanyContextChange = useCallback((args: { companyInput: string; companyDomain: string | null }) => {
    setActiveCompanyInput(args.companyInput)
    setActiveCompanyDomain(args.companyDomain)
  }, [])

  const loading = creditsLoading

  const autoStartEligible = (!initialHasIcp || totalLeads === 0) && !onboardingComplete

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <InAppTourProvider autoStartEligible={autoStartEligible} serverTourCompletedAt={initialTourCompletedAt}>
        <DashboardHeader />
      {/* Onboarding Wizard - Only show if server says not completed */}
      {((onboardingChecked && showOnboarding && !onboardingComplete) || manualOnboardingOpen) && (
        <OnboardingWizard
          initialStep={manualOnboardingOpen ? manualOnboardingStep : undefined}
          onComplete={() => {
            handleOnboardingComplete()
            setManualOnboardingOpen(false)
          }}
          onClose={() => {
            if (manualOnboardingOpen) setManualOnboardingOpen(false)
            else dismissOnboarding()
          }}
        />
      )}

      {/* Header */}
      <DashboardHeaderSection isPro={isPro} creditsRemaining={creditsRemaining} />

      {/* Debug Panel - Guarded behind NEXT_PUBLIC_ENABLE_DEBUG_UI */}
      {debugEnabled && showDebug && debugInfo && (
        <DebugPanel debugInfo={debugInfo} onClose={hideDebug} />
      )}

      {/* Stats Bar */}
      <StatsBar 
        totalLeads={totalLeads} 
        eventsCount={events.length} 
        isPro={isPro} 
        debugEnabled={debugEnabled}
        onDebugClick={checkWhoami}
      />

      {/* Main Content */}
      <div className="w-full overflow-x-auto" data-testid="dashboard-overflow-x">
        <div className="min-w-[1100px]">
          <main className="container mx-auto px-6 py-6">
        <Tabs defaultValue="command" className="space-y-6">
          <TabsList className="bg-background/50 border border-cyan-500/20">
            <TabsTrigger value="command" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
              Command Center
            </TabsTrigger>
            <TabsTrigger value="leads" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
              Lead Library
            </TabsTrigger>
            <TabsTrigger value="visitors" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
              Website Visitors
            </TabsTrigger>
            <TabsTrigger value="live-intent" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400">
              Live Intent
              {!isPro && (
                <Badge variant="outline" className="ml-2 border-purple-500/30 text-purple-400 bg-purple-500/10 text-xs h-4 px-1">
                  Pro
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="market" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
              Market Pulse
              {!isPro && (
                <Badge variant="outline" className="ml-2 border-purple-500/30 text-purple-400 bg-purple-500/10 text-xs h-4 px-1">
                  Pro
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="watchlist" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400">
              Watchlist
              {!isPro && (
                <Badge variant="outline" className="ml-2 border-purple-500/30 text-purple-400 bg-purple-500/10 text-xs h-4 px-1">
                  Pro
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="command" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Primary column */}
              <div className="lg:col-span-3 space-y-6">
                <QuickTourActionsCard
                  onOpenOnboarding={(step) => {
                    setManualOnboardingStep(step)
                    setManualOnboardingOpen(true)
                  }}
                />
                <ActivationGoalCard totalLeads={totalLeads} />
                <PitchGenerator
                  initialUrl={initialCompanyInput}
                  onCompanyContextChange={onCompanyContextChange}
                />
                <ScoreExplainerCard />
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

                <MarketSidebar />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="leads" className="space-y-6">
            {/* View Mode Toggle */}
            <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Main Column */}
              <div className="lg:col-span-3">
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
                          Upgrade to Pro to unlock your Lead Library, pitch history, and exports—and continue where you left off.
                        </div>
                        <Button
                          size="sm"
                          className="neon-border hover:glow-effect"
                          onClick={() => (window.location.href = '/pricing')}
                        >
                          Upgrade to Pro
                        </Button>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>

              {/* Right Sidebar - Markets */}
              <div className="lg:col-span-1">
                <MarketSidebar />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="visitors" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <WebsiteVisitors />
              </div>
              <div className="lg:col-span-1">
                <MarketSidebar />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="live-intent" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <ProGate
                  requiredTier="closer"
                  upgradeTarget="closer"
                  label="Live Intent (Pro)"
                  description="Unlock real-time intent signals and enrichment with the Closer plan."
                >
                  <LiveIntent isPro={isPro} />
                </ProGate>
              </div>
              <div className="lg:col-span-1">
                <MarketSidebar />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="market" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <ProGate
                  requiredTier="closer"
                  upgradeTarget="closer"
                  label="Market Pulse (Pro)"
                  description="Unlock real-time market pulse and alerts with the Closer plan."
                >
                  <MarketPulse />
                </ProGate>
              </div>
              <div className="lg:col-span-1">
                <MarketSidebar />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="watchlist" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <MarketSidebar />
              </div>
              <div className="lg:col-span-3">
                <ProGate
                  requiredTier="closer"
                  upgradeTarget="closer"
                  label="Watchlist (Pro)"
                  description="Unlock custom watchlists and alerts with the Closer plan."
                >
                  <MarketWatchlistTab />
                </ProGate>
              </div>
            </div>
          </TabsContent>

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
                  title="Autopilot is Pro-only"
                  description="Upgrade to Pro to enable Autopilot outreach."
                  icon="lock"
                  iconColor="purple"
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
        </Tabs>

        {/* Value Proposition Banner for Free Users */}
        {!isPro && creditsRemaining === 0 && (
          <Card className="mt-6 border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold mb-2">Credits Exhausted</h3>
                  <p className="text-sm text-muted-foreground">
                    You&apos;ve used your daily free lead. Upgrade to Pro for unlimited access to all leads with full contact details.
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/pricing')}
                  className="neon-border hover:glow-effect bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

          </main>
        </div>
      </div>
      </InAppTourProvider>
    </div>
  )
}
